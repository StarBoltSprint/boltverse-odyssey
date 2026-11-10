"""Adapters between the orchestrator and an in-house AI.

v0 can build a mock result, or shell out through CommandAdapter on the
machine that actually holds the weights. It does not import torch, MoGe,
SAM, or any other outside model. Unknown kinds become a stub that raises.
"""

from __future__ import annotations

import json
import re
import shlex
import subprocess
from typing import Any

import numpy as np

from .registry import AIEntry

# Family -> name of the in-house runner that would own it on the weight box.
# None of these runners ship in v0, so they resolve to StubAdapter.
_FAMILY_KIND = {
    "plinth": "numpy-shapenet",
    "plinth-pieces": "numpy-s4",
    "barrel": "numpy-barrel-net",
    "door": "numpy-door-net",
    "texture": "numpy-texture-net",
    "crate": "numpy-crate",
    "legacy-camera": "numpy-legacy",
    "legacy-depth": "numpy-legacy",
    "legacy-seg": "numpy-legacy",
    "legacy-critic": "numpy-legacy",
    "legacy-shape": "numpy-legacy",
    "legacy-texture": "numpy-legacy",
}

# Documented decoded fields. Values stay empty; only the shape is real.
_FIELDS = {
    "plinth-shape-v2": ("n", "tiers"),
    "plinth-camera-v1": ("yaw_deg", "elev_deg", "fov_deg"),
    "barrel": ("n", "h", "e", "p", "wall", "ld", "lid", "hoops"),
    "door": (
        "ns",
        "arch",
        "panel",
        "hs",
        "m",
        "kind",
        "window",
        "frame",
        "features",
        "straps",
    ),
    "texture": ("albedo_tile_32x32x3", "mean_rgb"),
    "plinth-pieces": ("K", "d0", "hb", "pieces"),
}

_HEAD_O = re.compile(r"\bo[c]?\s*\(\s*(\d+)\s*,?\s*\)")
_HEAD_EQ = re.compile(r"=\s*(\d+)\s*\(")


def kind_for(entry: AIEntry) -> str:
    return _FAMILY_KIND.get(entry.family, "unknown")


def raw_head_length(entry: AIEntry) -> int | None:
    """Read the documented head width out of the registry output sentence."""
    text = entry.output or ""
    match = _HEAD_O.search(text)
    if match:
        return int(match.group(1))
    match = _HEAD_EQ.search(text)
    if match:
        return int(match.group(1))
    return None


def _placeholder_vector(length: int) -> list:
    # numpy stamps the documented width. NaN becomes null so the JSON stays strict.
    vector = np.full(length, np.nan, dtype=np.float64)
    return [None if np.isnan(value) else float(value) for value in vector.tolist()]


def mock_output(entry: AIEntry) -> dict:
    """Registry output shape filled with placeholders. `_mock` is always true."""
    out: dict[str, Any] = {
        "_mock": True,
        "ai_id": entry.id,
        "placeholder": True,
        "note": "placeholder values only; checkpoint was not loaded",
    }
    fields = _FIELDS.get(entry.id) or _FIELDS.get(entry.family) or ()
    for name in fields:
        out[name] = None
    length = raw_head_length(entry)
    if length is not None:
        out["raw_head"] = _placeholder_vector(length)
        out["raw_head_shape"] = [length]
        out["raw_head_dtype"] = "float64"
    return out


class Adapter:
    """Base class. `load` prepares weights; `run` scores one payload."""

    def load(self) -> None:
        raise NotImplementedError("Adapter.load is not implemented")

    def run(self, payload: Any) -> dict:
        raise NotImplementedError("Adapter.run is not implemented")


class MockAdapter(Adapter):
    """Stand-in used when the weights are on another machine."""

    def __init__(self, entry: AIEntry):
        self.entry = entry
        self.loaded = False

    def load(self) -> None:
        # Deliberately does not open entry.checkpoint.
        self.loaded = True

    def run(self, payload: Any) -> dict:
        if not self.loaded:
            self.load()
        out = mock_output(self.entry)
        out["payload_ignored"] = True
        return out


class CommandAdapter(Adapter):
    """Shell out to a command template on the machine that has the weights.

    The template is split with shlex first, then each token is formatted.
    Placeholders: {ai_id} {checkpoint} {family} {entry_point} {payload}.
    `load` does not execute anything and does not read the checkpoint.
    """

    def __init__(self, entry: AIEntry, command_template: str):
        if not isinstance(command_template, str) or not command_template.strip():
            raise ValueError("command template must be a non-empty string")
        self.entry = entry
        self.command_template = command_template
        self.loaded = False

    def load(self) -> None:
        self.loaded = True

    def argv_for(self, payload: Any) -> list[str]:
        values = {
            "ai_id": self.entry.id,
            "checkpoint": self.entry.checkpoint,
            "family": self.entry.family,
            "entry_point": self.entry.entry_point,
            "payload": json.dumps(payload, default=str),
        }
        try:
            tokens = shlex.split(self.command_template, posix=True)
        except ValueError as exc:
            raise ValueError(f"bad command template: {exc}") from exc
        if not tokens:
            raise ValueError("command template is empty after parsing")
        try:
            return [token.format(**values) for token in tokens]
        except KeyError as exc:
            raise ValueError(f"unknown placeholder {exc} in command template") from exc

    def run(self, payload: Any) -> dict:
        if not self.loaded:
            self.load()
        argv = self.argv_for(payload)
        # shell=False. The caller chose the command; v0 does not add a network call.
        proc = subprocess.run(argv, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            detail = (proc.stderr or proc.stdout or "").strip()
            raise RuntimeError(f"command failed ({proc.returncode}): {detail}")
        text = (proc.stdout or "").strip()
        if not text:
            return {"stdout": ""}
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return {"stdout": proc.stdout}
        if not isinstance(data, dict):
            return {"result": data}
        return data


class StubAdapter(Adapter):
    """Fallback when the registry entry has no runnable adapter in v0."""

    def __init__(self, entry: AIEntry, kind: str):
        self.entry = entry
        self.kind = kind
        self.message = (
            f"no adapter implemented for {entry.id} (kind {kind!r}). "
            "v0 only runs MockAdapter and CommandAdapter."
        )

    def load(self) -> None:
        raise NotImplementedError(self.message)

    def run(self, payload: Any) -> dict:
        raise NotImplementedError(self.message)


def adapter_for(
    entry: AIEntry,
    *,
    mock: bool = False,
    command: str | None = None,
) -> Adapter:
    """Pick an adapter for one registry entry.

    `mock=True` always returns MockAdapter. A command string returns
    CommandAdapter. Anything else — including a known in-house kind that
    v0 does not ship, and a family this table does not know — is a stub.
    """
    if mock:
        return MockAdapter(entry)
    if command:
        return CommandAdapter(entry, command)
    return StubAdapter(entry, kind_for(entry))
