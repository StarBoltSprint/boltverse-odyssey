"""Refuse a library part unless every intake guard holds.

The numbers below are the ones written on the intake. This module does not
open PNGs, meshes, or play-check frames. A gate report is JSON only.
"""

from __future__ import annotations

import json
from pathlib import Path

from tools.library.resolve import LibraryError
from tools.library.verdict import rel_to_repo

ROOT = Path(__file__).resolve().parents[2]

# play-check shot kinds for a part. "approach" is the capture kind in
# tools/playcheck/src/walk.mjs (`05-${id}`, "approach"). "key" is the
# key-camera layer stored beside it.
CAMERA_LAYERS = frozenset({"key", "approach"})
RUN_TOOLS = frozenset({"object-gate", "tools/gate", "gate"})
LOD_SWITCH_M = (15, 40)


class IntakeRefused(LibraryError):
    def __init__(self, reasons: list[str]):
        self.reasons = list(reasons)
        super().__init__("intake refused: " + "; ".join(self.reasons))


def require_intake(part: dict, base: Path) -> dict:
    reasons, recorded = assess(part, base)
    if reasons:
        raise IntakeRefused(reasons)
    return recorded


def refusals(part: dict, base: Path) -> list[str]:
    reasons, _recorded = assess(part, base)
    return reasons


def assess(part: dict, base: Path) -> tuple[list[str], dict]:
    """Return refusal strings and the fields worth storing. Recorded is set when reasons is empty."""
    if not isinstance(part, dict):
        return ["intake is not an object"], {}
    reasons: list[str] = []
    recorded: dict = {}

    keep, keep_report = _art_director_keep(part, base)
    if keep:
        recorded["art_director"] = "KEEP"
        if keep_report:
            recorded["art_director_report"] = keep_report
    else:
        reasons.append("art director KEEP is missing")

    passed, run_body = _run_pass(part, base)
    if passed:
        recorded["run"] = run_body
    else:
        reasons.append("run verdict is not PASS")

    collision, collision_reasons = _collision(part)
    reasons.extend(collision_reasons)
    if not collision_reasons:
        recorded["collision"] = collision

    layer, layer_reason = _camera_layer(part)
    if layer_reason:
        reasons.append(layer_reason)
    else:
        recorded["camera_layer"] = layer

    chain, lod_reasons = _lod_chain(part)
    reasons.extend(lod_reasons)
    if not lod_reasons:
        recorded["lod_chain"] = chain

    textures, texture_reasons = _textures(part)
    reasons.extend(texture_reasons)
    if not texture_reasons:
        recorded["textures"] = textures

    if reasons:
        return reasons, {}
    return [], recorded


def _art_director_keep(part: dict, base: Path) -> tuple[bool, str | None]:
    raw = part.get("art_director", part.get("artDirector"))
    if raw == "KEEP":
        return True, None
    if isinstance(raw, str) and raw.endswith(".json"):
        data = _load_json(raw, base)
        if data is None:
            return False, None
        return _report_keep(data), _rel(raw, base)
    if isinstance(raw, dict):
        if raw.get("status") == "KEEP" or raw.get("verdict") == "KEEP" or raw.get("keep") is True:
            return True, None
        report = raw.get("report")
        if isinstance(report, str):
            data = _load_json(report, base)
            if data is None:
                return False, None
            return _report_keep(data), _rel(report, base)
    status = part.get("status")
    if status == "KEEP" and "art_director" not in part and "artDirector" not in part:
        return True, None
    return False, None


def _report_keep(data: dict) -> bool:
    if data.get("art_director") == "KEEP" or data.get("artDirector") == "KEEP":
        return True
    if data.get("status") == "KEEP":
        return True
    if data.get("keep") is True or data.get("KEEP") is True:
        return True
    flags = data.get("flags")
    if isinstance(flags, dict) and (flags.get("KEEP") is True or flags.get("keep") is True):
        return True
    nested = data.get("art_director")
    if isinstance(nested, dict) and (nested.get("status") == "KEEP" or nested.get("keep") is True):
        return True
    return False


def _run_pass(part: dict, base: Path) -> tuple[bool, dict]:
    raw = part.get("run", part.get("gate"))
    if isinstance(raw, dict):
        report = raw.get("report")
        if isinstance(report, str):
            data = _load_json(report, base)
            if data is None or not _report_pass(data):
                return False, {}
            tool = str(data.get("tool") or raw.get("tool") or "object-gate")
            if tool not in RUN_TOOLS:
                return False, {}
            return True, {"tool": tool, "verdict": "PASS", "report": _rel(report, base)}
        if raw.get("verdict") == "PASS" and _tool_ok(raw.get("tool")):
            tool = str(raw.get("tool") or "object-gate")
            return True, {"tool": tool, "verdict": "PASS"}
    return False, {}


def _report_pass(data: dict) -> bool:
    if data.get("verdict") != "PASS":
        return False
    return _tool_ok(data.get("tool"))


def _tool_ok(tool) -> bool:
    if tool is None:
        return True
    return str(tool) in RUN_TOOLS


def _collision(part: dict) -> tuple[dict, list[str]]:
    col = part.get("collision") if isinstance(part.get("collision"), dict) else {}
    boxes = col.get("boxes", part.get("collision_boxes"))
    anchor = col.get("ground_anchor", part.get("ground_anchor"))
    clearance = col.get("min_clearance_m", part.get("min_clearance_m"))
    reasons: list[str] = []
    stored_boxes: list[dict] = []
    if not isinstance(boxes, list) or len(boxes) == 0:
        reasons.append("missing local collision boxes")
    else:
        bad_space = False
        for box in boxes:
            parsed = _local_box(box)
            if parsed is None:
                bad_space = True
            else:
                stored_boxes.append(parsed)
        if not stored_boxes:
            reasons.append("missing local collision boxes")
        elif bad_space:
            reasons.append("collision boxes are not in local coordinates")
    anchor_v = _vec3(anchor)
    if anchor_v is None:
        reasons.append("missing ground_anchor")
    clearance_n = _number(clearance)
    if clearance_n is None or clearance_n < 0:
        reasons.append("missing min_clearance_m")
    if reasons:
        return {}, reasons
    return {
        "boxes": stored_boxes,
        "ground_anchor": anchor_v,
        "min_clearance_m": clearance_n,
    }, []


def _local_box(box) -> dict | None:
    if not isinstance(box, dict):
        return None
    space = box.get("space", box.get("coordinates"))
    if space != "local":
        return None
    lo = _vec3(box.get("min"))
    hi = _vec3(box.get("max"))
    if lo is None or hi is None:
        return None
    return {"min": lo, "max": hi, "space": "local"}


def _camera_layer(part: dict) -> tuple[dict, str | None]:
    raw = part.get("camera_layer", part.get("cameraLayer"))
    if isinstance(raw, str) and raw in CAMERA_LAYERS:
        return {"id": raw, "kind": raw}, None
    if isinstance(raw, dict):
        ident = raw.get("id")
        kind = raw.get("kind")
        if isinstance(ident, str) and ident and isinstance(kind, str) and kind in CAMERA_LAYERS:
            return {"id": ident, "kind": kind}, None
        if isinstance(ident, str) and ident in CAMERA_LAYERS and kind in (None, ident):
            return {"id": ident, "kind": ident}, None
    return {}, "missing camera layer"


def _lod_chain(part: dict) -> tuple[dict, list[str]]:
    chain = _chain_dict(part)
    reasons: list[str] = []
    levels: dict = {}
    if not isinstance(chain, dict):
        return {}, [
            "missing per-LOD triangle counts",
            "LOD outline diff at 15 m is missing",
            "LOD outline diff at 40 m is missing",
        ]
    for name in ("lod0", "lod1", "lod2"):
        level = chain.get(name)
        count = None
        if isinstance(level, dict):
            count = _tri_count(level.get("triangles", level.get("tris")))
        if count is None:
            reasons.append(f"missing per-LOD triangle counts ({name})")
        else:
            levels[name] = {"triangles": count}
    diffs = chain.get("outlineDiffPx")
    switches = chain.get("switches") if isinstance(chain.get("switches"), dict) else {}
    stored_diff: dict = {}
    for meters in LOD_SWITCH_M:
        value = _diff_at(diffs, switches, meters)
        if value is None:
            reasons.append(f"LOD outline diff at {meters} m is missing")
        elif value != 0:
            reasons.append(f"LOD outline diff at {meters} m is {value} px")
        else:
            stored_diff[str(meters)] = 0
    if reasons:
        return {}, reasons
    return {"lod0": levels["lod0"], "lod1": levels["lod1"], "lod2": levels["lod2"], "outlineDiffPx": stored_diff}, []


def _chain_dict(part: dict):
    lod = part.get("lod")
    if isinstance(lod, dict):
        if isinstance(lod.get("chain"), dict):
            return lod["chain"]
        if any(k in lod for k in ("lod0", "lod1", "lod2", "outlineDiffPx")):
            return lod
    if isinstance(part.get("lodChain"), dict):
        return part["lodChain"]
    return None


def _diff_at(diffs, switches, meters: int):
    key = str(meters)
    if isinstance(diffs, dict) and (key in diffs or meters in diffs):
        return _number(diffs.get(key, diffs.get(meters)))
    sw = switches.get(key, switches.get(meters, switches.get(f"{meters}m")))
    if isinstance(sw, dict):
        return _number(sw.get("outlineDiffPx", sw.get("diffPx")))
    return _number(sw) if sw is not None and not isinstance(sw, dict) else None


def _textures(part: dict) -> tuple[list, list[str]]:
    raw = part.get("textures")
    if not isinstance(raw, list) or len(raw) == 0:
        return [], ["texture native pixels missing < 1024", "texture has no mipmaps"]
    reasons: list[str] = []
    stored: list[dict] = []
    for tex in raw:
        if not isinstance(tex, dict):
            reasons.append("texture native pixels missing < 1024")
            reasons.append("texture has no mipmaps")
            continue
        side = _native_side(tex)
        if side is None or side < 1024:
            shown = "missing" if side is None else side
            reasons.append(f"texture native pixels {shown} < 1024")
        if tex.get("mipmaps") is not True:
            reasons.append("texture has no mipmaps")
        if side is not None and side >= 1024 and tex.get("mipmaps") is True:
            item = {"nativePx": int(side), "mipmaps": True}
            width = _number(tex.get("width"))
            height = _number(tex.get("height"))
            if width is not None and height is not None:
                item["width"] = int(width)
                item["height"] = int(height)
            stored.append(item)
    if reasons:
        return [], reasons
    return stored, []


def _native_side(tex: dict):
    px = _number(tex.get("nativePx", tex.get("native_px")))
    width = _number(tex.get("width"))
    height = _number(tex.get("height"))
    if width is not None and height is not None:
        side = min(width, height)
        if px is None:
            return side
        return min(px, side)
    return px


def _tri_count(value):
    number = _number(value)
    if number is None or number < 0 or int(number) != number:
        return None
    return int(number)


def _vec3(value):
    if not isinstance(value, (list, tuple)) or len(value) != 3:
        return None
    out = []
    for item in value:
        number = _number(item)
        if number is None:
            return None
        out.append(int(number) if int(number) == number else number)
    return out


def _number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return value


def _load_json(value: str, base: Path) -> dict | None:
    path = _resolve(value, base)
    if path is None or not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    return data


def _resolve(value: str, base: Path) -> Path | None:
    raw = Path(value)
    if raw.is_file():
        return raw
    cand = base / value
    if cand.is_file():
        return cand
    cand = ROOT / value
    if cand.is_file():
        return cand
    return None


def _rel(value: str, base: Path) -> str:
    path = _resolve(value, base)
    if path is None:
        return value
    return rel_to_repo(path, ROOT)
