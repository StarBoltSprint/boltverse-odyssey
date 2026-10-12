"""Resolve a library id to the paths a zone spec can place.

A walkaround id still loads asset.json. A block KEEP returns the registered
glb LODs, native 1024 plates, profile, gate report, and content hash.
A path string is not rewritten.
"""

from __future__ import annotations

import json
from pathlib import Path

from tools.layout.model import REPO, load_asset

LIBRARY = REPO / "biome" / "library"
SCHEMAS = ("library-object/1", "library-block/1")


class LibraryError(RuntimeError):
    pass


def library_root(roots: list[Path] | None = None) -> Path:
    for root in roots or []:
        cand = root / "biome" / "library"
        if cand.is_dir():
            return cand
    return LIBRARY


def manifest_path(object_id: str, roots: list[Path] | None = None) -> Path:
    _check_id(object_id)
    path = library_root(roots) / object_id / "manifest.json"
    if not path.is_file():
        raise LibraryError(f"library object not found: {object_id}")
    return path


def read_manifest(object_id: str, roots: list[Path] | None = None, library: Path | None = None) -> dict:
    if library is not None:
        _check_id(object_id)
        path = Path(library) / object_id / "manifest.json"
        if not path.is_file():
            raise LibraryError(f"library object not found: {object_id}")
    else:
        path = manifest_path(object_id, roots)
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise LibraryError(f"{object_id} manifest is not an object")
    if data.get("schema") not in SCHEMAS:
        raise LibraryError(f"{object_id} schema is not a library manifest")
    if data.get("id") != object_id:
        raise LibraryError(f"{object_id} manifest id is {data.get('id')}")
    return data


def resolve_registered(object_id: str, roots: list[Path] | None = None, library: Path | None = None) -> dict:
    """Registered paths for `{ "library": "<id>" }`. Does not move files."""
    data = read_manifest(object_id, roots, library)
    if data.get("schema") == "library-block/1" or data.get("kind") == "block":
        return {
            "id": object_id,
            "kind": "block",
            "glbs": dict(data.get("glbs") or {}),
            "plates": dict(data.get("plates") or {}),
            "profile": dict(data.get("profile") or {}),
            "gate": dict(data.get("gate") or {}),
            "contentHash": data.get("contentHash"),
            "nativePx": data.get("nativePx"),
        }
    return {
        "id": object_id,
        "kind": "walkaround",
        "asset": data.get("asset"),
        "views": data.get("views"),
        "shape": data.get("shape"),
    }


def resolve_spec_entry(entry, roots: list[Path] | None = None, library: Path | None = None):
    """A path string stays that string. `{ "library": "<id>" }` returns registered paths."""
    if isinstance(entry, str):
        return entry
    if isinstance(entry, dict) and isinstance(entry.get("library"), str) and len(entry) == 1:
        return resolve_registered(entry["library"], roots, library)
    raise LibraryError("an asset entry must be a path string or {\"library\": \"<id>\"}")


def load_library_asset(object_id: str, roots: list[Path]):
    """Same Asset as a path string. Adds library_id and library_scale. Does not move the file.

    Block KEEPs have no walkaround asset.json. Call resolve_registered for those paths.
    """
    data = read_manifest(object_id, roots)
    if data.get("schema") == "library-block/1" or data.get("kind") == "block":
        raise LibraryError(f"{object_id} is a block KEEP; use resolve_registered")
    asset_rel = data.get("asset")
    if not isinstance(asset_rel, str) or not asset_rel:
        raise LibraryError(f"{object_id} has no asset path")
    asset = load_asset(asset_rel, list(roots) + [REPO])
    asset.library_id = object_id
    scale = data.get("scale") or {}
    if "min" in scale and "max" in scale:
        lo, hi = float(scale["min"]), float(scale["max"])
        if lo > hi:
            raise LibraryError(f"{object_id} scale min is above max")
        asset.library_scale = (lo, hi)
    else:
        asset.library_scale = None
    return asset


def iter_manifests(root: Path | None = None) -> list[tuple[str, dict]]:
    base = root or LIBRARY
    if not base.is_dir():
        return []
    found = []
    for path in sorted(base.glob("*/manifest.json")):
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        found.append((path.parent.name, data))
    return found


def _check_id(object_id: str) -> None:
    if not object_id or len(object_id) > 64:
        raise LibraryError(f"bad library id {object_id!r}")
    ok = object_id[0].isalnum() and all(c.isalnum() or c == "-" for c in object_id)
    if not ok or object_id != object_id.lower():
        raise LibraryError(f"library id must be lowercase letters, digits, and hyphens: {object_id!r}")
