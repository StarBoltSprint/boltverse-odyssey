"""Read-only view of AI-REGISTRY.json.

Nothing here writes the registry file or touches a checkpoint.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Mapping

# Registry spellings mapped onto the five statuses the router understands.
# checkpoint_missing is the file's name for a weight file that is not on the box.
_STATUS = {
    "validated": "validated",
    "in_progress": "in_progress",
    "failed": "failed",
    "superseded": "superseded",
    "missing_weights": "missing_weights",
    "checkpoint_missing": "missing_weights",
}

# part_type strings a caller may use for a family already in the file.
# Free text inside an AI's "part" sentence is not an alias: wing / antenna /
# engine stay unmatched on purpose.
_ALIASES = {
    "socle": "plinth",
    "tonneau": "barrel",
    "porte": "door",
    "tint": "texture",
    "colour": "texture",
    "color": "texture",
    "texture/tint": "texture",
    "crates": "crate",
    "pieces": "plinth-pieces",
    "blocks": "plinth-pieces",
    "plinth pieces": "plinth-pieces",
}


def canonical_part_type(part_type: str) -> str:
    """Lower-case a part type and apply the small alias table."""
    if not isinstance(part_type, str) or not part_type.strip():
        raise ValueError("part type must be a non-empty string")
    key = re.sub(r"\s+", " ", part_type.strip().lower()).strip()
    key = key.replace("_", "-")
    return _ALIASES.get(key, key)


def normalize_status(raw: str) -> str:
    key = str(raw).strip().lower()
    return _STATUS.get(key, key)


@dataclass(frozen=True)
class AIEntry:
    """One AI row. Frozen so a caller cannot edit the inventory in memory."""

    id: str
    name: str
    family: str
    part: str
    status: str
    status_raw: str
    checkpoint: str
    code: str
    entry_point: str
    input: str
    output: str
    cpu_s_per_call: float | None
    cpu_note: str | None
    validation: str
    validation_gate: str | None
    fr: str | None
    proposal: str | None
    proposal_why: str | None
    interface_certainty: str | None

    @property
    def part_type(self) -> str:
        return canonical_part_type(self.family)


def refusal_reason(ai: AIEntry, *, allow_unvalidated: bool) -> str | None:
    """Plain reason this AI must not be called, or None if it may be routed.

    `allow_unvalidated` only opens `in_progress`. failed, superseded, and
    missing weights stay closed.
    """
    if ai.status == "validated":
        return None
    if ai.status == "in_progress":
        if allow_unvalidated:
            return None
        return "in_progress — not routable unless allow_unvalidated=True"
    if ai.status == "failed":
        return "failed — never routed"
    if ai.status == "superseded":
        return "superseded — never routed"
    if ai.status == "missing_weights":
        if ai.status_raw != "missing_weights":
            return (
                f"missing_weights (registry status_class {ai.status_raw!r})"
                " — never routed"
            )
        return "missing_weights — never routed"
    return f"status {ai.status_raw!r} is not routable"


def _cpu(value) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def _text(row: dict, key: str) -> str:
    value = row.get(key)
    if value is None:
        return ""
    return str(value)


def _optional_text(row: dict, key: str) -> str | None:
    value = row.get(key)
    if value is None:
        return None
    return str(value)


def _entry(row: dict) -> AIEntry:
    if not isinstance(row, dict):
        raise ValueError("each AI entry must be an object")
    ai_id = _text(row, "id").strip()
    if not ai_id:
        raise ValueError("AI entry is missing id")
    family = _text(row, "family").strip()
    if not family:
        raise ValueError(f"AI {ai_id!r} is missing family")
    if "status_class" not in row or row["status_class"] in (None, ""):
        raise ValueError(f"AI {ai_id!r} is missing status_class")
    raw_status = str(row["status_class"])
    return AIEntry(
        id=ai_id,
        name=_text(row, "name"),
        family=family,
        part=_text(row, "part"),
        status=normalize_status(raw_status),
        status_raw=raw_status,
        checkpoint=_text(row, "checkpoint"),
        code=_text(row, "code"),
        entry_point=_text(row, "entry_point"),
        input=_text(row, "input"),
        output=_text(row, "output"),
        cpu_s_per_call=_cpu(row.get("cpu_s_per_call")),
        cpu_note=_optional_text(row, "cpu_note"),
        validation=_text(row, "validation"),
        validation_gate=_optional_text(row, "validation_gate"),
        fr=_optional_text(row, "fr"),
        proposal=_optional_text(row, "proposal"),
        proposal_why=_optional_text(row, "proposal_why"),
        interface_certainty=_optional_text(row, "interface_certainty"),
    )


@dataclass(frozen=True)
class Registry:
    """In-memory copy of the inventory. No save, no delete."""

    generated: str
    rule: str
    heldout_sets: Mapping[str, str]
    count: int
    ais: tuple[AIEntry, ...]
    other_checkpoints: tuple[str, ...]
    pipelines: Mapping[str, str]
    source: str

    def get(self, ai_id: str) -> AIEntry:
        for ai in self.ais:
            if ai.id == ai_id:
                return ai
        raise KeyError(ai_id)

    def matches(self, part_type: str) -> tuple[AIEntry, ...]:
        """Every entry whose family is this part type, in file order."""
        key = canonical_part_type(part_type)
        return tuple(ai for ai in self.ais if ai.part_type == key)

    def routable(self, part_type: str, *, allow_unvalidated: bool = False) -> tuple[AIEntry, ...]:
        return tuple(
            ai
            for ai in self.matches(part_type)
            if refusal_reason(ai, allow_unvalidated=allow_unvalidated) is None
        )


def registry_from_dict(data: dict, *, source: str = "") -> Registry:
    if not isinstance(data, dict):
        raise ValueError("registry root must be an object")
    rows = data.get("ais")
    if not isinstance(rows, list):
        raise ValueError("registry field 'ais' must be a list")
    entries = tuple(_entry(row) for row in rows)
    seen: set[str] = set()
    for ai in entries:
        if ai.id in seen:
            raise ValueError(f"duplicate AI id {ai.id!r}")
        seen.add(ai.id)
    heldout = data.get("heldout_sets") or {}
    pipelines = data.get("pipelines") or {}
    others = data.get("other_checkpoints") or []
    if not isinstance(heldout, dict) or not isinstance(pipelines, dict):
        raise ValueError("heldout_sets and pipelines must be objects")
    if not isinstance(others, list):
        raise ValueError("other_checkpoints must be a list")
    declared = data.get("count")
    if declared is not None and int(declared) != len(entries):
        raise ValueError(
            f"registry count is {declared} but ais has {len(entries)} entries"
        )
    return Registry(
        generated=_text(data, "generated"),
        rule=_text(data, "rule"),
        heldout_sets=MappingProxyType({str(k): str(v) for k, v in heldout.items()}),
        count=len(entries),
        ais=entries,
        other_checkpoints=tuple(str(item) for item in others),
        pipelines=MappingProxyType({str(k): str(v) for k, v in pipelines.items()}),
        source=source,
    )


def load_registry(path: str | Path) -> Registry:
    """Load AI-REGISTRY.json. The file is opened for reading and never written."""
    src = Path(path)
    # Read-only on purpose: this tool must not rewrite the inventory.
    with src.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return registry_from_dict(data, source=str(src))
