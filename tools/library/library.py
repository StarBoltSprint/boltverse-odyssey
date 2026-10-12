#!/usr/bin/env python3
"""Reusable object library. add / list / check.

add copies nothing. It records a manifest for an object whose reports already PASS.
A WARN on a lock/ file is allowed. Any other FAIL is refused.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tools.library.resolve import LIBRARY, LibraryError, iter_manifests
from tools.library.verdict import ReportRejected, accept, load_report, rel_to_repo

NATIVE_PX = 1024


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv or argv[0] in ("-h", "--help"):
        print(_HELP)
        return 0 if argv and argv[0] in ("-h", "--help") else 2
    cmd, rest = argv[0], argv[1:]
    try:
        if cmd == "add":
            return add(rest)
        if cmd == "list":
            return list_cmd(rest)
        if cmd == "check":
            return check_cmd(rest)
    except (LibraryError, ReportRejected, OSError, json.JSONDecodeError, KeyError, ValueError) as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1
    print(f"unknown command {cmd}", file=sys.stderr)
    print(_HELP)
    return 2


def add(argv: list[str]) -> int:
    args = _parse(argv, {"--intake": 1, "--library": 1})
    intake_path = Path(args["--intake"])
    library = Path(args["--library"]) if "--library" in args else LIBRARY
    intake = json.loads(intake_path.read_text(encoding="utf-8"))
    manifest = build_manifest(intake, intake_path.parent)
    dest = library / manifest["id"]
    dest.mkdir(parents=True, exist_ok=True)
    out = dest / "manifest.json"
    out.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"PASS add {manifest['id']} {out}")
    return 0


def build_manifest(intake: dict, base: Path) -> dict:
    if str(intake.get("kind") or "") == "block":
        return build_block_manifest(intake, base)
    return _build_walkaround_manifest(intake, base)


def build_block_manifest(intake: dict, base: Path) -> dict:
    """Register a block KEEP: glb LODs, native 1024 plates, profile, gate, content hash."""
    from tools.library.resolve import _check_id

    object_id = str(intake["id"])
    _check_id(object_id)
    glbs_in = intake.get("glbs") or {}
    glbs = {}
    for lod in ("lod0", "lod1", "lod2"):
        if lod not in glbs_in:
            raise LibraryError(f"glbs.{lod} is required")
        path = _abs(str(glbs_in[lod]), base)
        if not path.is_file() or path.stat().st_size <= 0:
            raise LibraryError(f"missing glb {lod}: {path}")
        glbs[lod] = rel_to_repo(path, ROOT)
    plates_in = intake.get("plates") or {}
    if not isinstance(plates_in, dict) or not plates_in:
        raise LibraryError("plates is required")
    plates = {}
    for name, raw in plates_in.items():
        path = _abs(str(raw), base)
        _require_native_plate(path)
        plates[str(name)] = rel_to_repo(path, ROOT)
    profile_in = intake.get("profile") or {}
    if isinstance(profile_in, str):
        profile_path = _abs(profile_in, base)
        profile_id = ""
    else:
        profile_path = _abs(str(profile_in.get("path") or ""), base)
        profile_id = str(profile_in.get("id") or "")
    if not profile_path.is_file():
        raise LibraryError(f"profile missing: {profile_path}")
    profile_body = json.loads(profile_path.read_text(encoding="utf-8"))
    file_id = str(profile_body.get("id") or "")
    if not file_id:
        raise LibraryError("profile JSON has no id")
    if profile_id and profile_id != file_id:
        raise LibraryError(f"profile id {profile_id!r} does not match the file id {file_id!r}")
    profile_id = file_id
    gate_in = intake.get("gate")
    if isinstance(gate_in, str):
        gate_path = _abs(gate_in, base)
    elif isinstance(gate_in, dict):
        gate_path = _abs(str(gate_in.get("path") or ""), base)
    else:
        raise LibraryError("gate report path is required")
    if not gate_path.is_file():
        raise LibraryError(f"gate report missing: {gate_path}")
    gate_report = load_report(gate_path)
    verdict, notes = accept("gate", gate_report)
    hashed = [(f"glb:{lod}", _abs(glbs[lod], ROOT)) for lod in ("lod0", "lod1", "lod2")]
    hashed += [(f"plate:{name}", _abs(plates[name], ROOT)) for name in sorted(plates)]
    hashed.append(("profile", profile_path))
    hashed.append(("gate", gate_path))
    manifest = {
        "schema": "library-block/1",
        "id": object_id,
        "kind": "block",
        "fixture": bool(intake.get("fixture")),
        "glbs": glbs,
        "plates": plates,
        "profile": {"id": profile_id, "path": rel_to_repo(profile_path, ROOT)},
        "gate": {"path": rel_to_repo(gate_path, ROOT), "verdict": verdict, "notes": notes},
        "contentHash": _content_hash(hashed),
        "nativePx": NATIVE_PX,
    }
    return manifest


def _require_native_plate(path: Path) -> None:
    if not path.is_file():
        raise LibraryError(f"plate missing: {path}")
    from PIL import Image

    with Image.open(path) as im:
        size = im.size
    if size != (NATIVE_PX, NATIVE_PX):
        raise LibraryError(f"plate {path.name} is {size[0]}×{size[1]}; native {NATIVE_PX} required")


def _content_hash(items: list[tuple[str, Path]]) -> str:
    digest = hashlib.sha256()
    for label, path in items:
        data = path.read_bytes()
        digest.update(label.encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(len(data)).encode("ascii"))
        digest.update(b"\0")
        digest.update(data)
    return digest.hexdigest()


def _build_walkaround_manifest(intake: dict, base: Path) -> dict:
    object_id = str(intake["id"])
    from tools.library.resolve import _check_id

    _check_id(object_id)
    reports_in = intake["reports"]
    judged = {}
    for kind in ("assetcheck", "objsheet", "walkaround"):
        raw = _abs(reports_in[kind], base)
        report = load_report(raw)
        verdict, notes = accept(kind, report)
        judged[kind] = {
            "path": rel_to_repo(raw, ROOT),
            "verdict": verdict,
            "notes": notes,
        }
    views = _abs(intake["viewsDir"], base)
    if not views.is_dir():
        raise LibraryError(f"views dir missing: {views}")
    view_files = sorted(p.name for p in views.glob("*.png"))
    if len(view_files) < 8:
        raise LibraryError(f"{views} has {len(view_files)} png views; need at least 8")
    walk = _abs(intake["walkaroundDir"], base)
    asset = _abs(intake["asset"], base)
    if not (walk / "asset.json").is_file() and asset.name != "asset.json":
        raise LibraryError("walkaround dir has no asset.json")
    if not asset.is_file():
        raise LibraryError(f"asset missing: {asset}")
    scale = intake.get("scale") or {"min": 1.0, "max": 1.0, "default": 1.0}
    collider = intake.get("collider") or {}
    if "radius_m" not in collider:
        raise LibraryError("collider.radius_m is required")
    lod_in = (intake.get("lod") or {}).get("billboardViews") or view_files
    source = intake.get("source") or {}
    manifest = {
        "schema": "library-object/1",
        "id": object_id,
        "fixture": bool(intake.get("fixture")),
        "source": {
            "imagineIds": list(source.get("imagineIds") or []),
            "promptRef": str(source.get("promptRef") or ""),
        },
        "views": {
            "dir": rel_to_repo(views, ROOT),
            "files": view_files,
            "yawStepDeg": 45,
        },
        "shape": {
            "method": str(intake.get("shapeMethod") or ""),
            "walkaround": rel_to_repo(walk, ROOT),
        },
        "reports": judged,
        "scale": {
            "min": float(scale["min"]),
            "max": float(scale["max"]),
            "default": float(scale.get("default", scale["min"])),
        },
        "collider": {
            "type": str(collider.get("type") or "circle"),
            "radius_m": float(collider["radius_m"]),
        },
        "lod": {
            "billboardViews": list(lod_in),
            "impostor": True,
        },
        "asset": rel_to_repo(asset, ROOT),
    }
    if not manifest["shape"]["method"]:
        raise LibraryError("shapeMethod is required")
    if manifest["collider"]["type"] != "circle":
        raise LibraryError("collider type must be circle")
    return manifest


def list_cmd(argv: list[str]) -> int:
    args = _parse(argv, {"--library": 1})
    library = Path(args["--library"]) if "--library" in args else LIBRARY
    rows = iter_manifests(library)
    if not rows:
        print("(empty)")
        return 0
    for object_id, data in rows:
        if data.get("schema") == "library-block/1" or data.get("kind") == "block":
            gate = (data.get("gate") or {}).get("verdict", "?")
            profile = (data.get("profile") or {}).get("id", "")
            digest = str(data.get("contentHash") or "")[:12]
            print(f"{object_id}  kind=block  profile={profile}  gate={gate}  hash={digest}")
            continue
        reports = data.get("reports") or {}
        bits = []
        for kind in ("assetcheck", "objsheet", "walkaround"):
            bits.append(f"{kind}={(reports.get(kind) or {}).get('verdict', '?')}")
        shape = (data.get("shape") or {}).get("method", "")
        print(f"{object_id}  shape={shape}  {'  '.join(bits)}  asset={data.get('asset')}")
    return 0


def check_cmd(argv: list[str]) -> int:
    args = _parse(argv, {"--library": 1, "--id": 1})
    library = Path(args["--library"]) if "--library" in args else LIBRARY
    want = args.get("--id")
    rows = iter_manifests(library)
    if want:
        rows = [row for row in rows if row[0] == want]
        if not rows:
            raise LibraryError(f"library object not found: {want}")
    if not rows:
        print("PASS check (empty library)")
        return 0
    failed = 0
    for object_id, data in rows:
        problems = _check_one(library, object_id, data)
        if problems:
            failed += 1
            print(f"FAIL {object_id}")
            for line in problems:
                print(f"  {line}")
        else:
            print(f"PASS {object_id}")
    return 1 if failed else 0


def _check_one(library: Path, object_id: str, data: dict) -> list[str]:
    del library
    if data.get("schema") == "library-block/1" or data.get("kind") == "block":
        return _check_block(object_id, data)
    problems = []
    if data.get("schema") != "library-object/1" or data.get("id") != object_id:
        problems.append("schema or id does not match the folder")
    for rel in (
        (data.get("views") or {}).get("dir"),
        (data.get("shape") or {}).get("walkaround"),
        data.get("asset"),
    ):
        if not rel or not (ROOT / rel).exists():
            problems.append(f"missing {rel}")
    views_dir = ROOT / str((data.get("views") or {}).get("dir") or "")
    for name in (data.get("lod") or {}).get("billboardViews") or []:
        if not (views_dir / name).is_file():
            problems.append(f"missing billboard view {name}")
    reports = data.get("reports") or {}
    for kind in ("assetcheck", "objsheet", "walkaround"):
        rel = (reports.get(kind) or {}).get("path")
        if not rel or not (ROOT / rel).is_file():
            problems.append(f"missing {kind} report {rel}")
            continue
        try:
            report = load_report(ROOT / rel)
            verdict, _notes = accept(kind, report)
        except ReportRejected as exc:
            problems.append(str(exc))
            continue
        stored = (reports.get(kind) or {}).get("verdict")
        if stored not in ("PASS", "WARN"):
            problems.append(f"stored {kind} verdict {stored}")
        if verdict == "FAIL":
            problems.append(f"{kind} recheck FAIL")
    collider = data.get("collider") or {}
    if collider.get("type") != "circle" or not isinstance(collider.get("radius_m"), (int, float)):
        problems.append("collider must be a circle with radius_m")
    if float(collider.get("radius_m") or 0) <= 0:
        problems.append("collider radius must be > 0")
    return problems


def _check_block(object_id: str, data: dict) -> list[str]:
    problems = []
    if data.get("schema") != "library-block/1" or data.get("id") != object_id or data.get("kind") != "block":
        problems.append("schema or id does not match the folder")
    if data.get("nativePx") != NATIVE_PX:
        problems.append(f"nativePx is not {NATIVE_PX}")
    glbs = data.get("glbs") or {}
    plates = data.get("plates") or {}
    profile = data.get("profile") or {}
    gate = data.get("gate") or {}
    paths: list[tuple[str, Path]] = []
    for lod in ("lod0", "lod1", "lod2"):
        rel = glbs.get(lod)
        path = _stored_path(rel)
        if path is None or not path.is_file():
            problems.append(f"missing glb {lod}: {rel}")
        else:
            paths.append((f"glb:{lod}", path))
    if not plates:
        problems.append("no plates")
    for name in sorted(plates):
        path = _stored_path(plates[name])
        if path is None or not path.is_file():
            problems.append(f"missing plate {name}: {plates[name]}")
            continue
        try:
            _require_native_plate(path)
        except LibraryError as exc:
            problems.append(str(exc))
        else:
            paths.append((f"plate:{name}", path))
    profile_path = _stored_path(profile.get("path"))
    if profile_path is None or not profile_path.is_file():
        problems.append(f"missing profile {profile.get('path')}")
    else:
        paths.append(("profile", profile_path))
        try:
            body = json.loads(profile_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            problems.append(f"profile JSON: {exc}")
        else:
            if body.get("id") != profile.get("id"):
                problems.append(f"profile id {body.get('id')!r} != {profile.get('id')!r}")
    gate_path = _stored_path(gate.get("path"))
    if gate_path is None or not gate_path.is_file():
        problems.append(f"missing gate report {gate.get('path')}")
    else:
        paths.append(("gate", gate_path))
        try:
            report = load_report(gate_path)
            verdict, _notes = accept("gate", report)
        except ReportRejected as exc:
            problems.append(str(exc))
        else:
            if gate.get("verdict") not in ("PASS", "WARN"):
                problems.append(f"stored gate verdict {gate.get('verdict')}")
            if verdict == "FAIL":
                problems.append("gate recheck FAIL")
    if paths and not problems:
        digest = _content_hash(paths)
        if digest != data.get("contentHash"):
            problems.append("content hash does not match the registered bytes")
    elif data.get("contentHash") in (None, ""):
        problems.append("content hash missing")
    return problems


def _stored_path(rel) -> Path | None:
    if not isinstance(rel, str) or not rel:
        return None
    path = Path(rel)
    if path.is_file():
        return path
    cand = ROOT / rel
    if cand.is_file():
        return cand
    return path


def _abs(value: str, base: Path) -> Path:
    raw = Path(value)
    if raw.is_file() or raw.is_dir():
        return raw
    cand = (base / value)
    if cand.exists():
        return cand
    cand = ROOT / value
    if cand.exists():
        return cand
    return cand


def _parse(argv: list[str], spec: dict[str, int]) -> dict[str, str]:
    out: dict[str, str] = {}
    i = 0
    while i < len(argv):
        key = argv[i]
        if key not in spec:
            raise LibraryError(f"unknown argument {key}")
        if i + 1 >= len(argv):
            raise LibraryError(f"missing value for {key}")
        out[key] = argv[i + 1]
        i += 2
    return out


_HELP = """tools/library — reuse a validated object by id

  python3 tools/library/library.py add --intake <intake.json> [--library biome/library]
  python3 tools/library/library.py list [--library biome/library]
  python3 tools/library/library.py check [--id <object-id>] [--library biome/library]

add refuses a report that is not PASS. A WARN on a lock/ path, or locked: true, is allowed.
A block intake (kind=block) stores glb lod0/1/2, native 1024 plates, the profile id and path,
the gate report, and a content hash of those bytes. It does not copy the files.
The manifest records paths. It does not copy pixels and it does not recook.
"""


if __name__ == "__main__":
    sys.exit(main())
