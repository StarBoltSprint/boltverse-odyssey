#!/usr/bin/env python3
"""Gather one take's QC reports into a single offline phone page.

The page displays report files. It does not measure, resize, or draw.
"""

from __future__ import annotations

import argparse
import html
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
VIDEO_EXT = {".mp4", ".webm", ".mov"}

# Documented limits that the source tool prints in README / fail lines
# but does not always copy into the JSON `limits` object.
DOC_LIMITS = {
    "bandingFraction": ("0.045", "assetcheck basic: banding fraction above this fails"),
    "unkeyedBlack": ("0.02", "assetcheck alpha: unkeyed near-black fraction above this fails"),
    "haloPx": ("3", "assetcheck alpha: halo thicker than this fails"),
    "greenSpill": ("0.35", "assetcheck alpha: green fringe on more of the silhouette edge than this fails"),
    "greenFieldStd": ("18", "assetcheck alpha: green-field luma std above this fails"),
    "contrastRatio": ("1.75", "assetcheck tiling: contrast ratio above this fails; the written limits object omits this key"),
    "guideIou": ("0.97", "objsheet guide: silhouette IoU below this fails when a guide exists"),
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build one static phone page from a take's QC reports.")
    parser.add_argument("--take", required=True, help="Take name shown in the header.")
    parser.add_argument("--out", required=True, help="Folder for index.html and copied media.")
    parser.add_argument("--take-dir", default="", help="Auto-discover tool folders inside this take directory.")
    parser.add_argument("--assetcheck", action="append", default=None, help="assetcheck output directory (report.json). Repeatable.")
    parser.add_argument("--objsheet", action="append", default=None, help="objsheet output directory (report.json, sheet.png). Repeatable.")
    parser.add_argument("--walkaround", action="append", default=None, help="walkaround output directory (qc/report.json). Repeatable.")
    parser.add_argument("--layout", default=None, help="layout output directory (report.json, debug-topdown.png, clearing.json).")
    parser.add_argument("--playcheck", default=None, help="playcheck output directory (report.json, stills/, walk.mp4).")
    parser.add_argument("--asset-root", default="", help="Extra directory for resolving assetcheck file paths.")
    parser.add_argument("--play-url", default="", help="Play URL written on the page. Not fetched.")
    parser.add_argument("--date", default="", help="Header date (YYYY-MM-DD). Default: newest report mtime, else today UTC.")
    args = parser.parse_args(argv)

    discovered = discover(Path(args.take_dir)) if args.take_dir else empty_sources()
    sources = {
        "assetcheck": _pick_list(args.assetcheck, discovered["assetcheck"]),
        "objsheet": _pick_list(args.objsheet, discovered["objsheet"]),
        "walkaround": _pick_list(args.walkaround, discovered["walkaround"]),
        "layout": _pick_one(args.layout, discovered["layout"]),
        "playcheck": _pick_one(args.playcheck, discovered["playcheck"]),
    }
    missing = _missing_flags(sources)
    if missing:
        print("FAIL reportview: " + "; ".join(missing), file=sys.stderr)
        return 2

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    media = out / "media"
    if media.exists():
        shutil.rmtree(media)
    media.mkdir()
    copier = Copier(media)

    page = assemble(
        take=args.take,
        date=args.date or newest_date(sources),
        play_url=args.play_url.strip(),
        sources=sources,
        asset_root=Path(args.asset_root) if args.asset_root else None,
        copier=copier,
    )
    (out / "index.html").write_text(render(page), encoding="utf-8")
    print(f"{page['verdict']} take={args.take} page={out / 'index.html'}")
    return 0


def empty_sources() -> dict:
    return {"assetcheck": [], "objsheet": [], "walkaround": [], "layout": None, "playcheck": None}


def discover(take_dir: Path) -> dict:
    found = empty_sources()
    if not take_dir.is_dir():
        return found
    ac = take_dir / "assetcheck"
    if (ac / "report.json").is_file():
        found["assetcheck"].append(ac)
    elif ac.is_dir():
        found["assetcheck"].extend(p for p in sorted(ac.iterdir()) if (p / "report.json").is_file())
    ob = take_dir / "objsheet"
    if (ob / "report.json").is_file():
        found["objsheet"].append(ob)
    elif ob.is_dir():
        found["objsheet"].extend(p for p in sorted(ob.iterdir()) if (p / "report.json").is_file())
    wa = take_dir / "walkaround"
    if (wa / "qc" / "report.json").is_file():
        found["walkaround"].append(wa)
    elif wa.is_dir():
        found["walkaround"].extend(p for p in sorted(wa.iterdir()) if (p / "qc" / "report.json").is_file())
    if (take_dir / "layout" / "report.json").is_file():
        found["layout"] = take_dir / "layout"
    if (take_dir / "playcheck" / "report.json").is_file():
        found["playcheck"] = take_dir / "playcheck"
    return found


def _pick_list(explicit, discovered):
    if explicit is None:
        return [Path(p) for p in discovered]
    return [Path(p) for p in explicit]


def _pick_one(explicit, discovered):
    if explicit is None:
        return Path(discovered) if discovered else None
    return Path(explicit) if explicit else None


def _missing_flags(sources) -> list[str]:
    bad = []
    for label, dirs in (
        ("assetcheck", sources["assetcheck"]),
        ("objsheet", sources["objsheet"]),
        ("walkaround", sources["walkaround"]),
    ):
        for d in dirs:
            if not d.is_dir():
                bad.append(f"--{label} is not a directory: {d}")
    for label in ("layout", "playcheck"):
        d = sources[label]
        if d is not None and not d.is_dir():
            bad.append(f"--{label} is not a directory: {d}")
    return bad


def newest_date(sources) -> str:
    stamps = []
    files = []
    for d in sources["assetcheck"] + sources["objsheet"] + sources["walkaround"]:
        files.append(d / "report.json")
        files.append(d / "qc" / "report.json")
    for label in ("layout", "playcheck"):
        d = sources[label]
        if d is not None:
            files.append(d / "report.json")
    for f in files:
        if f.is_file():
            stamps.append(f.stat().st_mtime)
    if not stamps:
        return datetime.now(timezone.utc).date().isoformat()
    return datetime.fromtimestamp(max(stamps), timezone.utc).date().isoformat()


class Copier:
    def __init__(self, media: Path):
        self.media = media
        self.n = 0

    def copy(self, src: Path | None, bucket: str) -> str | None:
        if src is None or not src.is_file():
            return None
        dest_dir = self.media / bucket
        dest_dir.mkdir(parents=True, exist_ok=True)
        self.n += 1
        name = f"{self.n:03d}-{_safe_name(src.name)}"
        dest = dest_dir / name
        shutil.copyfile(src, dest)
        return f"media/{bucket}/{name}"


def _safe_name(name: str) -> str:
    keep = []
    for ch in name:
        if ch.isalnum() or ch in "._-":
            keep.append(ch)
        else:
            keep.append("_")
    return "".join(keep) or "file"


def load_json(path: Path) -> tuple[dict | None, str | None]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return None, str(exc)
    if not isinstance(data, dict):
        return None, "report.json is not an object"
    return data, None


def assemble(take, date, play_url, sources, asset_root, copier: Copier) -> dict:
    assets = section_assets(sources["assetcheck"], asset_root, copier)
    objects = section_objects(sources["objsheet"], sources["walkaround"], copier)
    layout = section_layout(sources["layout"], copier)
    play = section_play(sources["playcheck"], copier)
    sections = [assets, objects, layout, play]
    return {
        "take": take,
        "date": date,
        "playUrl": play_url,
        "verdict": overall([s["status"] for s in sections]),
        "sections": sections,
    }


def overall(statuses: list[str]) -> str:
    if "FAIL" in statuses:
        return "FAIL"
    if "NOT RUN" in statuses:
        return "INCOMPLETE"
    if "WARN" in statuses:
        return "WARN"
    if statuses and all(s == "PASS" for s in statuses):
        return "PASS"
    return "INCOMPLETE"


def worst(statuses: list[str]) -> str:
    active = [s for s in statuses if s not in ("SKIP", "n/a")]
    if "FAIL" in active:
        return "FAIL"
    if "WARN" in active:
        return "WARN"
    if "NOT RUN" in active:
        return "NOT RUN"
    if "PASS" in active:
        return "PASS"
    if "SKIP" in statuses or "n/a" in statuses:
        return "SKIP"
    return "NOT RUN"


def section_assets(dirs: list[Path], asset_root: Path | None, copier: Copier) -> dict:
    if not dirs:
        return {"id": "assets", "title": "Assets", "tool": "tools/assetcheck", "status": "NOT RUN", "blocks": [], "note": "No assetcheck directory was passed."}
    blocks = []
    statuses = []
    for d in dirs:
        report, err = _report(d)
        if err:
            statuses.append("FAIL")
            blocks.append({"kind": "error", "title": str(d), "status": "FAIL", "text": err})
            continue
        assets = report.get("assets")
        if not isinstance(assets, list):
            statuses.append("FAIL")
            blocks.append({"kind": "error", "title": str(d), "status": "FAIL", "text": "report.json has no assets list."})
            continue
        if not assets:
            blocks.append({"kind": "note", "text": "The report's assets list is empty."})
        for asset in assets:
            if not isinstance(asset, dict):
                continue
            block = asset_block(d, asset, asset_root, copier)
            blocks.append(block)
            statuses.append(block["status"])
        if report.get("ok") is False and "FAIL" not in statuses:
            statuses.append("FAIL")
    return {
        "id": "assets",
        "title": "Assets",
        "tool": "tools/assetcheck",
        "status": worst(statuses) if statuses else "PASS",
        "blocks": blocks,
        "note": "Magnification is on-screen size divided by source size. The limit in the report is 1.0.",
    }


def asset_block(directory: Path, asset: dict, asset_root: Path | None, copier: Copier) -> dict:
    checks = asset.get("checks") if isinstance(asset.get("checks"), dict) else {}
    status = asset_status(asset)
    src = resolve_file(directory, asset.get("file") or "", asset_root)
    thumb = None
    if src is not None and src.suffix.lower() in IMAGE_EXT:
        thumb = copier.copy(src, "assets")
    rows = []
    rows.append(resolution_row(checks.get("resolution")))
    rows.append(alpha_row(checks.get("alpha")))
    rows.append(loop_row(checks.get("loop")))
    rows.append(basic_row(checks.get("basic")))
    if isinstance(checks.get("tiling"), dict):
        rows.append(tiling_row(checks["tiling"]))
    if isinstance(checks.get("backdrop"), dict):
        rows.append(backdrop_row(checks["backdrop"]))
    if isinstance(checks.get("morph"), dict):
        rows.append(morph_row(checks["morph"]))
    basic = checks.get("basic") if isinstance(checks.get("basic"), dict) else {}
    res = checks.get("resolution") if isinstance(checks.get("resolution"), dict) else {}
    frame = res.get("frame") if isinstance(res.get("frame"), list) else [basic.get("width"), basic.get("height")]
    return {
        "kind": "asset",
        "title": str(asset.get("file") or "asset"),
        "status": status,
        "kindName": asset.get("kind"),
        "locked": bool(asset.get("locked")),
        "lockReason": asset.get("lockReason"),
        "codec": basic.get("codec"),
        "width": frame[0] if frame else None,
        "height": frame[1] if len(frame) > 1 else None,
        "thumb": thumb,
        "thumbMissing": src is None or src.suffix.lower() not in IMAGE_EXT,
        "isVideo": src is not None and src.suffix.lower() in VIDEO_EXT,
        "rows": rows,
        "failures": _str_list(asset.get("failures")),
        "warnings": _str_list(asset.get("warnings")),
    }


def asset_status(asset: dict) -> str:
    checks = asset.get("checks") if isinstance(asset.get("checks"), dict) else {}
    statuses = []
    for check in checks.values():
        if isinstance(check, dict) and check.get("status"):
            statuses.append(str(check["status"]))
    if "FAIL" in statuses or asset.get("ok") is False:
        return "FAIL"
    if "WARN" in statuses or _str_list(asset.get("warnings")):
        return "WARN"
    if statuses:
        return "PASS"
    return "NOT RUN"


def resolution_row(check) -> dict:
    if not isinstance(check, dict):
        return na_row("Magnification", "No resolution check in this report.")
    mag = check.get("magnification")
    limit = check.get("magnificationLimit")
    frame = check.get("frame")
    screen = check.get("onScreen")
    return metric_row(
        check.get("status") or "n/a",
        "Magnification",
        f"measured {fmt(mag)} · limit {fmt(limit)}",
        "On-screen size at the closest camera, divided by the source (the mask for a cutout, the frame otherwise). Above 1.0 means the picture would be enlarged.",
        [
            f"frame {fmt_pair(frame)}",
            f"on-screen {fmt_pair(screen)}",
            f"compared {fmt(check.get('compared'))}",
        ],
        _str_list(check.get("failures")) + _str_list(check.get("warnings")),
    )


def alpha_row(check) -> dict:
    if not isinstance(check, dict):
        return na_row("Alpha / plate", "No alpha check in this report.")
    bits = [f"key {fmt(check.get('key'))}"]
    if "unkeyedBlackFraction" in check:
        bits.insert(0, f"unkeyed black {fmt(check.get('unkeyedBlackFraction'))} · limit {DOC_LIMITS['unkeyedBlack'][0]}")
    if "plateFraction" in check:
        bits.append(f"plate fraction {fmt(check.get('plateFraction'))}")
    if "haloThicknessPx" in check:
        bits.append(f"halo {fmt(check.get('haloThicknessPx'))} px · limit {DOC_LIMITS['haloPx'][0]} px")
    if "greenSpillFraction" in check:
        bits.append(f"green spill {fmt(check.get('greenSpillFraction'))} · limit {DOC_LIMITS['greenSpill'][0]}")
    summary = bits[0] if bits else "alpha"
    return metric_row(
        check.get("status") or "n/a",
        "Alpha / plate",
        summary,
        "Cutouts and keyed loops are checked for a real plate. An opaque near-black field, a thick halo, or a green fringe misses. On a lock/ file the same miss is WARN, and WARN is not a FAIL.",
        bits[1:],
        _str_list(check.get("failures")) + _str_list(check.get("warnings")),
    )


def loop_row(check) -> dict:
    if not isinstance(check, dict):
        return na_row("Loop seam", "No loop check in this report.")
    limits = check.get("limits") if isinstance(check.get("limits"), dict) else {}
    summary = (
        f"seam MAE {fmt(check.get('seamMAE'))} · limit {fmt(limits.get('seamMAE'))}"
        f" · p95 {fmt(check.get('seamP95'))} · limit {fmt(limits.get('seamP95'))}"
        f" · flow {fmt(check.get('seamFlowPx'))} px · limit {fmt(limits.get('seamFlowPx'))} px"
    )
    return metric_row(
        check.get("status") or "n/a",
        "Loop seam",
        summary,
        "Last frame against the first, on a downscale. The limits object in the report is the threshold. A lock/ miss is WARN.",
        [
            f"frozen hits {fmt(check.get('frozenHits'))} · frozen window {fmt(limits.get('frozenSec'))} s",
            f"pop limit {fmt(check.get('popLimit'))}",
        ],
        _str_list(check.get("failures")) + _str_list(check.get("warnings")),
    )


def basic_row(check) -> dict:
    if not isinstance(check, dict):
        return na_row("Codec", "No basic check in this report.")
    summary = (
        f"codec {fmt(check.get('codec'))} · {fmt(check.get('width'))}×{fmt(check.get('height'))}"
        f" · banding {fmt(check.get('bandingFraction'))} · limit {DOC_LIMITS['bandingFraction'][0]}"
    )
    extra = []
    if check.get("fps") is not None:
        extra.append(f"fps {fmt(check.get('fps'))} · frames {fmt(check.get('frames'))} · {fmt(check.get('durationSec'))} s")
    extra.append(f"lossless {fmt(check.get('lossless'))} · required {fmt(check.get('losslessRequired'))}")
    return metric_row(
        check.get("status") or "n/a",
        "Codec",
        summary,
        "The file has to open. Stills, cutouts, tiles, and backdrops require PNG unless the report says otherwise. Banding above the assetcheck limit fails. A lock/ miss is WARN.",
        extra,
        _str_list(check.get("failures")) + _str_list(check.get("warnings")),
    )


def tiling_row(check: dict) -> dict:
    limits = check.get("limits") if isinstance(check.get("limits"), dict) else {}
    summary = (
        f"exposure {fmt(check.get('exposureDelta'))} · limit {fmt(limits.get('exposureDelta'))}"
        f" · contrast {fmt(check.get('contrastRatio'))} · limit {DOC_LIMITS['contrastRatio'][0]}"
    )
    return metric_row(
        check.get("status") or "n/a",
        "Tiling",
        summary,
        "Wrap seam fails when the ratio is above the report limit and the absolute seam is above the report limit. Exposure uses the limits object. Contrast uses the tool's fail line (1.75); that key is not copied into limits.",
        [
            f"seam ratio limit {fmt(limits.get('seamRatio'))}",
            f"seam absolute limit {fmt(limits.get('seamAbs'))}",
        ],
        _str_list(check.get("failures")),
    )


def backdrop_row(check: dict) -> dict:
    summary = (
        f"width {fmt(check.get('width'))} · WebGL max {fmt(check.get('webglMaxTexture'))}"
        f" · vertical mag {fmt(check.get('verticalMagnification'))} · limit 1.0"
    )
    return metric_row(
        check.get("status") or "n/a",
        "Backdrop",
        summary,
        "Width above the WebGL max must be split before upload. Vertical magnification uses the same 1.0 rule as other assets. A hard horizontal seam uses the tile seam limits.",
        [f"split needed {fmt(check.get('splitNeeded'))}"],
        _str_list(check.get("failures")),
    )


def morph_row(check: dict) -> dict:
    limits = check.get("limits") if isinstance(check.get("limits"), dict) else {}
    jumps = check.get("jumps") if isinstance(check.get("jumps"), list) else []
    worst_jump = jumps[0] if jumps and isinstance(jumps[0], dict) else {}
    summary = (
        f"area jump {fmt(worst_jump.get('areaJump'))} · limit {fmt(limits.get('areaJump'))}"
        f" · height jump {fmt(worst_jump.get('heightJump'))} · limit {fmt(limits.get('heightJump'))}"
        f" · IoU {fmt(worst_jump.get('iou'))} · limit {fmt(limits.get('iou'))}"
    )
    return metric_row(
        check.get("status") or "n/a",
        "Morph",
        summary,
        "A turntable must keep one shape. Area, height, and silhouette IoU are compared with the limits object on this check.",
        [f"frames measured {fmt(check.get('framesMeasured'))}"],
        _str_list(check.get("failures")),
    )


def section_objects(sheet_dirs: list[Path], walk_dirs: list[Path], copier: Copier) -> dict:
    if not sheet_dirs and not walk_dirs:
        return {"id": "objects", "title": "Objects", "tool": "tools/objsheet + tools/walkaround", "status": "NOT RUN", "blocks": [], "note": "No objsheet or walkaround directory was passed."}
    sheets = []
    walks = []
    statuses = []
    blocks = []
    for d in sheet_dirs:
        report, err = _report(d)
        if err:
            statuses.append("FAIL")
            blocks.append({"kind": "error", "title": str(d), "status": "FAIL", "text": err})
            continue
        objects = report.get("objects")
        if not isinstance(objects, list):
            statuses.append("FAIL")
            blocks.append({"kind": "error", "title": str(d), "status": "FAIL", "text": "report.json has no objects list."})
            continue
        sheet_rel = copier.copy(_existing(d / str(report.get("sheet") or "sheet.png")), "objects")
        sheets.append({"dir": d, "report": report, "sheet": sheet_rel, "objects": [o for o in objects if isinstance(o, dict)]})
    for d in walk_dirs:
        report, err = _report(d / "qc")
        if err:
            statuses.append("FAIL")
            blocks.append({"kind": "error", "title": str(d), "status": "FAIL", "text": err})
            continue
        walks.append({"dir": d, "report": report, "name": str(report.get("name") or d.name)})
    used_walks = set()
    for sheet in sheets:
        group_objects = []
        for obj in sheet["objects"]:
            name = str(obj.get("name") or "object")
            walk = _match_walk(name, walks, used_walks)
            card = object_card(name, sheet["dir"], obj, walk, copier)
            group_objects.append(card)
            statuses.append(card["status"])
        blocks.append({"kind": "proof", "sheet": sheet["sheet"], "ok": sheet["report"].get("ok"), "objects": group_objects})
    for i, walk in enumerate(walks):
        if i in used_walks:
            continue
        card = object_card(walk["name"], None, None, walk, copier)
        statuses.append(card["status"])
        blocks.append({"kind": "proof", "sheet": None, "ok": None, "objects": [card]})
    note = "Objsheet is the proof sheet and the view checks. Walkaround qc/report.json is the hull: depth refinement, vertex and face counts, smoothing, sub-objects."
    if sheet_dirs and not walk_dirs:
        note += " No walkaround directory was passed, so hull rows are NOT RUN."
    if walk_dirs and not sheet_dirs:
        note += " No objsheet directory was passed, so proof-sheet rows are NOT RUN."
    return {
        "id": "objects",
        "title": "Objects",
        "tool": "tools/objsheet + tools/walkaround",
        "status": worst(statuses) if statuses else "NOT RUN",
        "blocks": blocks,
        "note": note,
    }


def _match_walk(name: str, walks: list[dict], used: set) -> dict | None:
    for i, walk in enumerate(walks):
        if i in used:
            continue
        if walk["name"] == name:
            used.add(i)
            return walk
    return None


def object_card(name: str, sheet_dir: Path | None, obj: dict | None, walk: dict | None, copier: Copier) -> dict:
    rows = []
    view_rows = []
    if obj is None:
        rows.append(na_row("Proof sheet", "No objsheet object was matched to this hull."))
    else:
        rows.extend(object_check_rows(obj))
        view_rows = view_cards(sheet_dir, obj, walk, copier)
    hull = hull_block(walk, copier)
    status = worst([r["status"] for r in rows] + [v["status"] for v in view_rows] + [hull["status"]])
    if obj is not None and obj.get("ok") is False:
        status = "FAIL"
    if walk is not None and walk["report"].get("ok") is False:
        status = "FAIL"
    return {
        "kind": "object",
        "title": name,
        "status": status,
        "rows": rows,
        "views": view_rows,
        "hull": hull,
        "failures": _str_list(None if obj is None else obj.get("failures")) + _str_list(None if walk is None else walk["report"].get("failures")),
    }


def object_check_rows(obj: dict) -> list[dict]:
    rows = []
    for key, title, explain in (
        ("silhouette", "Silhouette", "A keyed subject whose fill stays at or below 0.92. An empty mask, or a mask that is the whole frame, fails."),
        ("ring", "Yaw ring", "Eight horizontal yaws, every 45°. Elevated stills are drawn and are not part of this ring."),
        ("consistency", "View consistency", "Adjacent views stay within the limits object: area ±15% and height ±8% in the tool. Opposite views compare width and height, not a pixel mirror."),
        ("guide", "Guide IoU", "Each still against its guide mask. The limit field on this check is the threshold. SKIP means no guide was given; that is not a PASS and not a FAIL."),
        ("hull", "Hull keep", "Coarse 7-of-8 carve. The limits object holds minKeep and meanKeep. This is not the smooth mesh."),
        ("margin", "Frame margin", "Empty margin on every side of the unfilled mask. Under 3% the still is cropped and the carve follows the frame. Width and height are measured from the file. Above 2048 px on a side fails."),
        ("holes", "Interior holes", "Transparent pixels enclosed by the silhouette, as a fraction of interior pixels. Above 0.2% the stone is see-through. The tool does not fill those pixels."),
    ):
        check = obj.get(key)
        if not isinstance(check, dict):
            if key in ("margin", "holes"):
                continue
            rows.append(na_row(title, "This check is not in the objsheet report."))
            continue
        rows.append(check_summary_row(title, check, explain))
    return rows


def check_summary_row(title: str, check: dict, explain: str) -> dict:
    limits = check.get("limits") if isinstance(check.get("limits"), dict) else {}
    limit_bits = [f"{k} {fmt(v)}" for k, v in limits.items()]
    measured = []
    fills = [v.get("fillArea") for v in check.get("views") or [] if isinstance(v, dict) and isinstance(v.get("fillArea"), (int, float))]
    if fills:
        measured.append(f"fill {fmt(max(fills))} · limit 0.92")
    if isinstance(check.get("yaws"), list):
        measured.append(f"yaws {len(check['yaws'])} · expected 8")
    for key in ("meanKeep", "minKeep", "volumeFraction", "reason", "minMarginFrac", "maxHoleFraction", "maxEdgePx"):
        if key in check:
            measured.append(f"{key} {fmt(check.get(key))}")
    if title == "Guide IoU":
        ious = [v.get("iou") for v in check.get("views") or [] if isinstance(v, dict) and "iou" in v]
        if ious:
            measured.append(f"IoU min {fmt(min(ious))} · max {fmt(max(ious))} · limit {fmt(check.get('limit'))}")
        elif check.get("status") == "SKIP":
            measured.append(f"limit {fmt(check.get('limit') if check.get('limit') is not None else DOC_LIMITS['guideIou'][0])}")
    if title == "View consistency":
        adj = [a for a in check.get("adjacent") or [] if isinstance(a, dict)]
        if adj:
            areas = [a.get("areaDelta") for a in adj if isinstance(a.get("areaDelta"), (int, float))]
            heights = [a.get("heightDelta") for a in adj if isinstance(a.get("heightDelta"), (int, float))]
            if areas:
                measured.append(f"worst area delta {fmt(max(areas))} · limit {fmt(limits.get('area'))}")
            if heights:
                measured.append(f"worst height delta {fmt(max(heights))} · limit {fmt(limits.get('height'))}")
    summary = measured[0] if measured else (limit_bits[0] if limit_bits else str(check.get("status") or ""))
    return metric_row(
        str(check.get("status") or "n/a"),
        title,
        summary,
        explain,
        measured[1:] + [f"limits: {', '.join(limit_bits)}" if limit_bits else ""],
        _str_list(check.get("failures")),
    )


def view_cards(sheet_dir: Path | None, obj: dict, walk: dict | None, copier: Copier) -> list[dict]:
    views = obj.get("views") if isinstance(obj.get("views"), list) else []
    guide = obj.get("guide") if isinstance(obj.get("guide"), dict) else {}
    guide_by = {v.get("file"): v for v in guide.get("views") or [] if isinstance(v, dict)}
    cons = obj.get("consistency") if isinstance(obj.get("consistency"), dict) else {}
    limits = cons.get("limits") if isinstance(cons.get("limits"), dict) else {}
    adj = {a.get("a"): a for a in cons.get("adjacent") or [] if isinstance(a, dict)}
    hull = obj.get("hull") if isinstance(obj.get("hull"), dict) else {}
    hull_limits = hull.get("limits") if isinstance(hull.get("limits"), dict) else {}
    keep_by = {v.get("file"): v for v in hull.get("views") or [] if isinstance(v, dict)}
    mag_by = {}
    if walk is not None:
        mag = walk["report"].get("magnification") if isinstance(walk["report"].get("magnification"), dict) else {}
        for item in mag.get("perView") or []:
            if isinstance(item, dict):
                mag_by[item.get("file")] = item
    cards = []
    guide_limit = guide.get("limit", DOC_LIMITS["guideIou"][0])
    for view in views:
        if not isinstance(view, dict):
            continue
        fname = str(view.get("file") or "")
        thumb, thumb_kind = find_view_image(sheet_dir, walk, obj.get("name"), fname, copier)
        g = guide_by.get(fname) or {}
        pair = adj.get(fname) or {}
        keep = keep_by.get(fname) or {}
        mag = mag_by.get(fname) or {}
        rows = []
        if guide.get("status") == "SKIP":
            rows.append(metric_row("SKIP", "Silhouette IoU", f"no guide · limit {fmt(guide_limit)}", "No guide frame was supplied, so IoU was not measured. SKIP is not a PASS.", [], []))
        elif "iou" in g:
            iou_status = "FAIL" if _num(g.get("iou")) < _num(guide_limit) else "PASS"
            if guide.get("status") == "PASS":
                iou_status = "PASS"
            rows.append(metric_row(iou_status, "Silhouette IoU", f"measured {fmt(g.get('iou'))} · limit {fmt(guide_limit)}", "Intersection over union of this still's mask and its guide mask.", [], []))
        else:
            rows.append(na_row("Silhouette IoU", "This view has no iou field on the guide check."))
        if pair:
            area_ok = _within(pair.get("areaDelta"), limits.get("area"))
            height_ok = _within(pair.get("heightDelta"), limits.get("height"))
            color_fail = _color_fail(pair, limits)
            if cons.get("status") == "PASS":
                pair_status = "PASS"
            elif (not area_ok) or (not height_ok) or color_fail:
                pair_status = "FAIL"
            else:
                pair_status = "PASS"
            rows.append(metric_row(
                pair_status,
                "Consistency",
                f"area delta {fmt(pair.get('areaDelta'))} · limit {fmt(limits.get('area'))} · height delta {fmt(pair.get('heightDelta'))} · limit {fmt(limits.get('height'))}",
                "Change versus the next yaw. The limits object on the consistency check is the threshold. Colour correlation is reported and only fails together with a large colour distance.",
                [f"colour corr {fmt(pair.get('colorCorr'))} · colour distance {fmt(pair.get('colorDist'))} · corr limit {fmt(limits.get('colorCorr'))} · distance limit {fmt(limits.get('colorDist'))}"],
                [],
            ))
        else:
            rows.append(na_row("Consistency", "No adjacent pair starts at this view."))
        if keep:
            min_keep = hull_limits.get("minKeep")
            keep_status = "FAIL" if min_keep is not None and _num(keep.get("keepFraction")) < _num(min_keep) else str(hull.get("status") or "PASS")
            if hull.get("status") == "PASS":
                keep_status = "PASS"
            rows.append(metric_row(
                keep_status,
                "Hull keep",
                f"keep {fmt(keep.get('keepFraction'))} · min {fmt(min_keep)} · mean limit {fmt(hull_limits.get('meanKeep'))}",
                "Share of this mask that the coarse 7-of-8 carve still covers.",
                [],
                [],
            ))
        if mag:
            mag_limit = 1.0
            mreport = walk["report"].get("magnification") if walk else {}
            if isinstance(mreport, dict) and mreport.get("limit") is not None:
                mag_limit = mreport.get("limit")
            mag_status = "FAIL" if _num(mag.get("maxMagnification")) > _num(mag_limit) else "PASS"
            rows.append(metric_row(
                mag_status,
                "Hull magnification",
                f"measured {fmt(mag.get('maxMagnification'))} · limit {fmt(mag_limit)}",
                "Projected hull size divided by this still's silhouette. The walkaround report limit is 1.0.",
                [f"source {fmt(mag.get('sourceWidth'))}×{fmt(mag.get('sourceHeight'))}"],
                [],
            ))
        elif walk is None:
            rows.append({"status": "NOT RUN", "title": "Hull magnification", "summary": "walkaround was not passed", "explain": "Per-view magnification lives on walkaround qc/report.json.", "extra": [], "lines": []})
        cards.append({
            "file": fname,
            "yaw": view.get("yawDeg"),
            "width": view.get("width"),
            "height": view.get("height"),
            "thumb": thumb,
            "thumbKind": thumb_kind,
            "status": worst([r["status"] for r in rows]),
            "rows": rows,
        })
    return cards


def find_view_image(sheet_dir, walk, obj_name, fname, copier: Copier):
    candidates = []
    if walk is not None:
        base = walk["dir"]
        candidates.append((base / "views" / fname, "source view"))
        if obj_name:
            candidates.append((base / "views" / f"{obj_name}-{fname}", "source view"))
        candidates.append((base / "qc" / fname, "qc render"))
    if sheet_dir is not None:
        candidates.append((sheet_dir / fname, "source view"))
        candidates.append((sheet_dir / "views" / fname, "source view"))
    for path, kind in candidates:
        if path.is_file() and path.suffix.lower() in IMAGE_EXT:
            return copier.copy(path, "objects"), kind
    return None, None


def hull_block(walk: dict | None, copier: Copier) -> dict:
    if walk is None:
        return {
            "status": "NOT RUN",
            "rows": [{"status": "NOT RUN", "title": "Hull", "summary": "walkaround was not passed", "explain": "Depth, vertex counts, and sub-objects are read from qc/report.json.", "extra": [], "lines": []}],
            "subs": [],
        }
    report = walk["report"]
    hull = report.get("hull") if isinstance(report.get("hull"), dict) else {}
    status = "FAIL" if report.get("ok") is False else "PASS"
    depth_status = status if report.get("depthRefine") not in (None, "skipped") else "SKIP"
    if report.get("depthRefine") == "skipped":
        depth_summary = "refinement skipped"
    else:
        depth_summary = f"refinement {fmt(report.get('depthRefine'))}"
    range_bits = depth_range_bits(report, hull)
    rows = [
        metric_row(
            depth_status,
            "Depth",
            f"{depth_summary} · recess {fmt(hull.get('depthRelief'))} of local thickness · agree {fmt(hull.get('depthMinAgree'))}",
            "depthRefine is the refinement status (skipped, png, or depth-anything-v2). depthRelief is how far depth may recess, as a fraction of local thickness. depthMinAgree is how many depth views must agree. A numeric near/far range is shown only when the report stores one.",
            range_bits,
            [],
        ),
        metric_row(
            status,
            "Mesh",
            f"vertices {fmt(hull.get('vertexCount'))} · faces {fmt(hull.get('triangleCount'))} · smooth iters {fmt(hull.get('smoothIters'))} · surface {fmt(hull.get('surface'))}",
            "Vertex and face counts are the smooth mesh when surface nets ran. smoothIters is the Taubin count stored on the report. The report does not set a pass/fail budget on those counts. The chip follows the hull report's ok flag.",
            _mesh_extra(hull, report),
            _str_list(report.get("failures")),
        ),
    ]
    subs = []
    for sub in report.get("subObjects") or []:
        if not isinstance(sub, dict):
            continue
        subs.append({
            "name": sub.get("name"),
            "vertexCount": sub.get("vertexCount"),
            "viewCount": sub.get("viewCount"),
            "joint": sub.get("joint"),
            "axis": sub.get("axis"),
        })
    return {"status": status, "rows": rows, "subs": subs}


def depth_range_bits(report: dict, hull: dict) -> list[str]:
    found = []
    for container, label in ((report, "report"), (hull, "hull")):
        if isinstance(container.get("depthRange"), (list, tuple)) and len(container["depthRange"]) >= 2:
            found.append(f"{label} depthRange {fmt(container['depthRange'][0])}–{fmt(container['depthRange'][1])}")
        if "depthMin" in container or "depthMax" in container:
            found.append(f"{label} depth {fmt(container.get('depthMin'))}–{fmt(container.get('depthMax'))}")
    if found:
        return found
    return ["near/far range: not recorded in qc/report.json"]


def _mesh_extra(hull: dict, report: dict) -> list[str]:
    extra = []
    if "vertexCount" not in hull and isinstance(report.get("coverage"), dict):
        extra.append(f"surface points {fmt(report['coverage'].get('surfaceCount'))} (coverage.surfaceCount; vertexCount was not in this report)")
    edges = hull.get("edges") if isinstance(hull.get("edges"), dict) else None
    if edges and "boundary" in edges:
        extra.append(f"boundary edges {fmt(edges.get('boundary'))}")
    seam = report.get("seam") if isinstance(report.get("seam"), dict) else {}
    if "meanFragmentSeamFraction" in seam:
        extra.append(f"mean seam fraction {fmt(seam.get('meanFragmentSeamFraction'))}")
    return extra


def section_layout(directory: Path | None, copier: Copier) -> dict:
    if directory is None:
        return {"id": "layout", "title": "Layout", "tool": "tools/layout", "status": "NOT RUN", "blocks": [], "note": "No layout directory was passed."}
    report, err = _report(directory)
    if err:
        return {"id": "layout", "title": "Layout", "tool": "tools/layout", "status": "FAIL", "blocks": [{"kind": "error", "title": "layout", "status": "FAIL", "text": err}], "note": ""}
    rows_in = report.get("rows") if isinstance(report.get("rows"), list) else None
    if rows_in is None:
        return {"id": "layout", "title": "Layout", "tool": "tools/layout", "status": "FAIL", "blocks": [{"kind": "error", "title": "layout", "status": "FAIL", "text": "report.json has no rows list."}], "note": ""}
    diagram = copier.copy(_existing(directory / "debug-topdown.png"), "layout")
    clearing, clearing_err = (None, None)
    cpath = directory / "clearing.json"
    if cpath.is_file():
        clearing, clearing_err = load_json(cpath)
    else:
        clearing_err = "missing"
    order = {"ring_closed": 0, "gate": 1, "collider_eq_visual": 2}
    indexed = list(enumerate(r for r in rows_in if isinstance(r, dict)))
    indexed.sort(key=lambda item: (order.get(item[1].get("name"), 50), item[0]))
    rows = [layout_row(r) for _, r in indexed]
    status = "FAIL" if report.get("ok") is False else worst([r["status"] for r in rows] or ["PASS"])
    if any(r["status"] == "FAIL" for r in rows):
        status = "FAIL"
    return {
        "id": "layout",
        "title": "Layout",
        "tool": "tools/layout",
        "status": status,
        "zone": report.get("id"),
        "diagram": diagram,
        "clearingId": None if not isinstance(clearing, dict) else clearing.get("id"),
        "clearingGates": len(clearing.get("gates")) if isinstance(clearing, dict) and isinstance(clearing.get("gates"), list) else None,
        "clearingErr": None if isinstance(clearing, dict) else clearing_err,
        "blocks": [],
        "rows": rows,
        "note": "Invisible shape only. debug-topdown.png is the tool's diagram, not a play view. A layout PASS is not a framebuffer.",
    }


LAYOUT_EXPLAIN = {
    "ring_closed": "A 1° ray from the centre must hit the visual ring and the collider ring outside a gate. A missed arc longer than the hero width fails. Both gaps are in the numbers.",
    "collider_eq_visual": "A collider needs an object and an object needs a collider, within about 2 cm. An outward ray that hits a collider more than 0.5 m before any visual fails. A collider centred on the zone whose radius is the ring radius is a ring wall and fails.",
    "gate": "The frame asset has to be present, the opening has to clear the hero and the path, and no collider may enter the opening.",
    "path": "Clearance from the spawn point to the gate mouth is compared with half the path width (need_m in the numbers).",
    "gate_cone": "A solid circle meeting the cone in front of a gate fails.",
    "spawn_clearance": "A solid surface inside the spawn disk fails. clearance_m is measured, need_m is the threshold.",
    "separation": "Interiors must keep min_gap_m of air. Adjacent ring pieces may overlap so the ring can close.",
    "relief": "base_y_m has to match the relief at that xz. worst_err_m is the measured error.",
    "mag": "On-screen magnification at the closest follow camera. worst is measured, mag_max is the limit.",
    "variety": "A neighbour that matches asset, yaw, and scale together fails. Variant counts should stay within one of each other.",
    "fog_band": "Fewer than 20 patches, or a patch outside the annulus, fails.",
    "near_lens": "The spawn surface must sit at or beyond cull_m.",
    "budgets": "A category count outside the range copied into the file fails.",
    "playcheck_data": "Data half of the playcheck ring test only. It does not read pixels.",
    "bolt_paths": "gallop and idle paths must be non-empty strings in the file. This row does not open the files.",
    "rules_present": "The checker found every named rule.",
}


def layout_row(row: dict) -> dict:
    name = str(row.get("name") or "row")
    numbers = row.get("numbers") if isinstance(row.get("numbers"), dict) else {}
    summary = layout_summary(name, numbers)
    extra = [f"{k} = {fmt(v)}" for k, v in numbers.items()]
    note = row.get("note") or ""
    if note:
        extra.append(str(note))
    return metric_row(
        str(row.get("status") or "n/a"),
        name,
        summary,
        LAYOUT_EXPLAIN.get(name, "Row from tools/layout report.json."),
        extra,
        [],
    )


def layout_summary(name: str, numbers: dict) -> str:
    if name == "ring_closed":
        return f"visual gap {fmt(numbers.get('visual_gap_deg'))}° · collider gap {fmt(numbers.get('collider_gap_deg'))}° · hero width {fmt(numbers.get('hero_width_m'))} m"
    if name == "gate":
        return f"frame missing {fmt(numbers.get('frame_missing'))} · opening blocked {fmt(numbers.get('opening_blocked'))} · narrow {fmt(numbers.get('narrow'))} · threshold 0"
    if name == "collider_eq_visual":
        return f"collider only {fmt(numbers.get('collider_only'))} · object only {fmt(numbers.get('object_only'))} · invisible stops {fmt(numbers.get('invisible_stops'))} · threshold 0"
    if name == "mag":
        return f"worst {fmt(numbers.get('worst'))} · limit {fmt(numbers.get('mag_max'))}"
    if name == "path":
        return f"clearance {fmt(numbers.get('min_clearance_m'))} m · need {fmt(numbers.get('need_m'))} m"
    if name == "spawn_clearance":
        return f"clearance {fmt(numbers.get('clearance_m'))} m · need {fmt(numbers.get('need_m'))} m"
    if name == "near_lens":
        return f"spawn surface {fmt(numbers.get('spawn_surface_m'))} m · cull {fmt(numbers.get('cull_m'))} m"
    if name == "separation":
        return f"worst gap {fmt(numbers.get('worst_gap_m'))} m · min {fmt(numbers.get('min_gap_m'))} m"
    if name == "playcheck_data":
        return f"ray misses {fmt(numbers.get('ray_misses'))} · threshold 0"
    scalars = [f"{k} {fmt(v)}" for k, v in numbers.items() if isinstance(v, (int, float, str))]
    return " · ".join(scalars[:3]) if scalars else name


def section_play(directory: Path | None, copier: Copier) -> dict:
    if directory is None:
        return {"id": "play", "title": "Playcheck", "tool": "tools/playcheck", "status": "NOT RUN", "blocks": [], "note": "No playcheck directory was passed."}
    report, err = _report(directory)
    if err:
        return {"id": "play", "title": "Playcheck", "tool": "tools/playcheck", "status": "FAIL", "blocks": [{"kind": "error", "status": "FAIL", "title": "playcheck", "text": err}], "note": ""}
    rows_in = report.get("rows") if isinstance(report.get("rows"), list) else None
    if rows_in is None:
        return {"id": "play", "title": "Playcheck", "tool": "tools/playcheck", "status": "FAIL", "blocks": [{"kind": "error", "status": "FAIL", "title": "playcheck", "text": "report.json has no rows list."}], "note": ""}
    video = report.get("video") if isinstance(report.get("video"), dict) else {}
    video_path = _resolve_video(directory, video)
    video_rel = copier.copy(video_path, "play") if video_path else None
    stills = []
    for rel in report.get("stills") or []:
        src = directory / str(rel)
        copied = copier.copy(src if src.is_file() else None, "play")
        stills.append({"name": Path(str(rel)).name, "src": copied})
    rows = [play_row(r) for r in rows_in if isinstance(r, dict)]
    summary = report.get("summary") if isinstance(report.get("summary"), dict) else {}
    status = worst([r["status"] for r in rows] or ["NOT RUN"])
    if summary.get("result") == "FAIL" or report.get("ok") is False:
        status = "FAIL"
    return {
        "id": "play",
        "title": "Playcheck",
        "tool": "tools/playcheck",
        "status": status,
        "url": report.get("url"),
        "layoutId": report.get("layoutId"),
        "video": video,
        "videoRel": video_rel,
        "stills": stills,
        "rows": rows,
        "notes": _str_list(report.get("notes")),
        "blocks": [],
        "note": "Rendered-pixel rows from playcheck. The clip is the report's walk.mp4, copied next to this page.",
    }


def _resolve_video(directory: Path, video: dict) -> Path | None:
    named = video.get("file")
    if named:
        p = Path(str(named))
        if p.is_file():
            return p
        local = directory / p.name
        if local.is_file():
            return local
    for candidate in (directory / "walk.mp4", directory / "walk.webm"):
        if candidate.is_file():
            return candidate
    return None


PLAY_EXPLAIN = {
    "webgl_errors": "Any gl.getError or console WebGL error fails, including texSubImage3D.",
    "webgl_clean": "Same WebGL capture as webgl_errors.",
    "mag_max": "Peak HUD magnification, including magSources when present. The limit in the numbers is the threshold.",
    "mag": "Same HUD peak as mag_max.",
    "stops_visible": "A stop has to meet a layout surface, and something from the layout has to cover the view ahead.",
    "collider_eq_visual": "The stop is more than 0.5 m from a layout surface, or that surface is not visible.",
    "solids_world_locked": "A solid crop that stays pixel-identical across a 5° orbit step is a camera-facing card. Zero identical pairs is the pass. The harness records the count and does not apply it.",
    "layout_rendered": "A hull, gate, or interior the walk faced never wrote visible pixels.",
    "ring_closed": "A 1° data ray misses outside the gate, or a heading from the centre shows no edge pixels.",
    "gate": "The frame is not visible at its heading, the HUD bearing or distance is off, or the opening never sets pathTrigger.",
    "near_lens": "nearestVisibleM is missing or inside cull_m.",
    "fog_band": "Fewer than 20 patches in the file, or fog pixels are missing or hard-edged.",
    "black_regions": "A large flat near-black rectangle. A full-width band that touches the top is ignored. This row is a heuristic.",
    "tile_repeat": "Obvious periodic repetition on the ground band. This row is a heuristic.",
    "backdrop_res": "On-screen pixels of a backdrop slice exceed the source pixels.",
    "single_hero": "Not exactly one hero blob, or idle and gallop were not both captured.",
    "single_bolt": "Same single-hero check under the doc 63 name.",
    "idle_gallop_switch": "A moving frame has to be GALLOP, and the stop frame IDLE at about speed 0.",
    "fullscreen": "The canvas or screenshot is not 720×1600.",
    "debug_hook": "snapshot() or the ID buffer is missing.",
}


def play_row(row: dict) -> dict:
    name = str(row.get("id") or row.get("name") or "row")
    numbers = row.get("numbers") if isinstance(row.get("numbers"), dict) else {}
    summary = play_summary(name, numbers)
    extra = []
    for k, v in numbers.items():
        if isinstance(v, (int, float, str, bool)) or v is None:
            extra.append(f"{k} = {fmt(v)}")
        elif isinstance(v, list):
            extra.append(f"{k} = {len(v)} items")
        elif isinstance(v, dict):
            extra.append(f"{k} = {len(v)} fields")
    detail = row.get("detail") or ""
    explain = str(detail) if detail else PLAY_EXPLAIN.get(name, "Row from tools/playcheck report.json.")
    flags = []
    if row.get("heuristic"):
        flags.append("heuristic")
    if row.get("partial"):
        flags.append("partial")
    if flags:
        extra.append("marked " + ", ".join(flags))
    return metric_row(str(row.get("result") or row.get("status") or "n/a"), name, summary, explain, extra, [])


def play_summary(name: str, numbers: dict) -> str:
    if "mag_max" in numbers and "limit" in numbers:
        return f"measured {fmt(numbers.get('mag_max'))} · limit {fmt(numbers.get('limit'))}"
    if name == "webgl_errors" or name == "webgl_clean":
        return f"errors {fmt(numbers.get('count'))} · threshold 0"
    if "count" in numbers and len(numbers) <= 3:
        return f"count {fmt(numbers.get('count'))}"
    scalars = [(k, v) for k, v in numbers.items() if isinstance(v, (int, float, str, bool))]
    return " · ".join(f"{k} {fmt(v)}" for k, v in scalars[:3]) if scalars else name


def metric_row(status, title, summary, explain, extra, lines) -> dict:
    return {
        "status": str(status or "n/a"),
        "title": title,
        "summary": summary,
        "explain": explain,
        "extra": [e for e in extra if e],
        "lines": lines,
    }


def na_row(title, explain) -> dict:
    return metric_row("n/a", title, "not in this report", explain, [], [])


def _report(directory: Path) -> tuple[dict | None, str | None]:
    path = directory / "report.json"
    if not path.is_file():
        return None, f"report.json not found in {directory}"
    data, err = load_json(path)
    if err:
        return None, f"could not read {path}: {err}"
    return data, None


def _existing(path: Path) -> Path | None:
    return path if path.is_file() else None


def resolve_file(directory: Path, file_field: str, asset_root: Path | None) -> Path | None:
    if not file_field:
        return None
    raw = Path(file_field)
    candidates = []
    if raw.is_absolute():
        candidates.append(raw)
    else:
        candidates.append((directory / raw).resolve())
        candidates.append(directory / raw.name)
        candidates.append(directory.parent / raw)
        if asset_root is not None:
            candidates.append(asset_root / raw)
    for c in candidates:
        if c.is_file():
            return c
    return None


def _str_list(value) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v) for v in value if v is not None and str(v) != ""]


def _num(value) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float("nan")


def _color_fail(pair: dict, limits: dict) -> bool:
    try:
        corr = float(pair.get("colorCorr"))
        dist = float(pair.get("colorDist"))
        corr_lim = float(limits.get("colorCorr"))
        dist_lim = float(limits.get("colorDist"))
    except (TypeError, ValueError):
        return False
    return corr < corr_lim and dist > dist_lim


def _within(measured, limit) -> bool:
    if measured is None or limit is None:
        return True
    try:
        return float(measured) <= float(limit) + 1e-9
    except (TypeError, ValueError):
        return True


def fmt(value) -> str:
    if value is None:
        return "—"
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, float):
        text = f"{value:.4f}".rstrip("0").rstrip(".")
        return text if text else "0"
    if isinstance(value, list):
        return "×".join(fmt(v) for v in value)
    return str(value)


def fmt_pair(value) -> str:
    if isinstance(value, list) and len(value) >= 2:
        return f"{fmt(value[0])}×{fmt(value[1])}"
    return fmt(value)


def render(page: dict) -> str:
    verdict = page["verdict"]
    parts = [
        "<!DOCTYPE html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f"<title>{esc(page['take'])} QC</title>",
        f"<style>{CSS}</style>",
        "</head>",
        f'<body data-verdict="{esc(verdict)}">',
        '<main class="wrap">',
        render_header(page),
        nav(page["sections"]),
    ]
    for section in page["sections"]:
        parts.append(render_section(section))
    parts.append(
        '<p class="foot">This page only displays the reports it was given. It does not measure again and it does not draw.</p>'
    )
    parts.append("</main></body></html>\n")
    return "\n".join(parts)


def render_header(page: dict) -> str:
    url = page["playUrl"]
    if url:
        url_html = f'<a class="play" href="{esc(url)}">{esc(url)}</a>'
    else:
        url_html = '<p class="na">no play URL supplied</p>'
    counts = []
    for section in page["sections"]:
        counts.append(f'<span class="count">{chip(section["status"])} {esc(section["title"])}</span>')
    return (
        "<header>"
        f"<p class=\"kicker\">QC report</p>"
        f"<h1>{esc(page['take'])}</h1>"
        f"<p class=\"date\">{esc(page['date'])}</p>"
        f"<p id=\"overall\">{chip(page['verdict'])}</p>"
        f"<div class=\"counts\">{''.join(counts)}</div>"
        f"{url_html}"
        "</header>"
    )


def nav(sections) -> str:
    links = "".join(f'<a href="#{esc(s["id"])}">{esc(s["title"])}</a>' for s in sections)
    return f'<nav>{links}</nav>'


def render_section(section: dict) -> str:
    body = [f'<section id="{esc(section["id"])}">', "<h2>", esc(section["title"]), " ", chip(section["status"]), "</h2>"]
    body.append(f'<p class="tool">{esc(section["tool"])}</p>')
    if section.get("note"):
        body.append(f'<p class="note">{esc(section["note"])}</p>')
    if section["id"] == "assets":
        body.append(render_assets(section))
    elif section["id"] == "objects":
        body.append(render_objects(section))
    elif section["id"] == "layout":
        body.append(render_layout(section))
    elif section["id"] == "play":
        body.append(render_play(section))
    body.append("</section>")
    return "".join(body)


def render_assets(section: dict) -> str:
    chunks = []
    for block in section["blocks"]:
        if block["kind"] == "error":
            chunks.append(error_card(block))
            continue
        if block["kind"] == "note":
            chunks.append(f'<p class="note">{esc(block["text"])}</p>')
            continue
        thumb = thumb_html(block.get("thumb"), block["title"], block.get("isVideo"))
        lock = ""
        if block.get("locked"):
            reason = block.get("lockReason") or "locked"
            lock = f'<p class="lock">lock/ · {esc(reason)} · WARN is not a FAIL</p>'
        meta = f'{esc(block.get("kindName") or "")} · {esc(fmt(block.get("width")))}×{esc(fmt(block.get("height")))} · {esc(fmt(block.get("codec")))}'
        chunks.append(
            '<article class="card">'
            '<div class="assethead">'
            f"{thumb}<div><h3>{esc(block['title'])}</h3><p class=\"meta\">{meta}</p>{chip(block['status'])}{lock}</div>"
            "</div>"
            + "".join(render_row(r) for r in block["rows"])
            + messages(block.get("failures"), block.get("warnings"))
            + "</article>"
        )
    if not chunks and section["status"] == "NOT RUN":
        chunks.append('<p class="na">NOT RUN</p>')
    return "".join(chunks)


def render_objects(section: dict) -> str:
    chunks = []
    for block in section["blocks"]:
        if block["kind"] == "error":
            chunks.append(error_card(block))
            continue
        sheet = ""
        if block.get("sheet"):
            sheet = f'<figure><img src="{esc(block["sheet"])}" alt="proof sheet"><figcaption>proof sheet</figcaption></figure>'
        elif section["status"] != "NOT RUN":
            sheet = '<p class="na">proof sheet not in this folder</p>'
        cards = "".join(render_object(obj) for obj in block.get("objects") or [])
        chunks.append(f'<article class="card">{sheet}{cards}</article>')
    if not chunks and section["status"] == "NOT RUN":
        chunks.append('<p class="na">NOT RUN</p>')
    return "".join(chunks)


def render_object(obj: dict) -> str:
    views = []
    for view in obj.get("views") or []:
        img = f'<img src="{esc(view["thumb"])}" alt="{esc(view["file"])}">' if view.get("thumb") else '<div class="ph">no still</div>'
        kind = f'<p class="meta">{esc(view.get("thumbKind") or "")}</p>' if view.get("thumbKind") else ""
        views.append(
            '<div class="view">'
            f"{img}<div><strong>{esc(view['file'])}</strong>"
            f'<p class="meta">yaw {esc(fmt(view.get("yaw")))} · {esc(fmt(view.get("width")))}×{esc(fmt(view.get("height")))}</p>'
            f"{kind}{chip(view['status'])}"
            + "".join(render_row(r) for r in view["rows"])
            + "</div></div>"
        )
    hull = obj.get("hull") or {}
    subs = []
    for sub in hull.get("subs") or []:
        subs.append(
            "<li>"
            f"<strong>{esc(fmt(sub.get('name')))}</strong> · vertices {esc(fmt(sub.get('vertexCount')))}"
            f" · views {esc(fmt(sub.get('viewCount')))} · joint {esc(fmt(sub.get('joint')))}"
            "</li>"
        )
    sub_html = "<h4>Sub-objects</h4><ul>" + "".join(subs) + "</ul>" if subs else "<p class=\"meta\">subObjects: none in this hull report</p>"
    if hull.get("status") == "NOT RUN":
        sub_html = ""
    return (
        '<div class="object">'
        f"<h3>{esc(obj['title'])} {chip(obj['status'])}</h3>"
        + "".join(render_row(r) for r in obj.get("rows") or [])
        + ('<div class="views">' + "".join(views) + "</div>" if views else "")
        + '<div class="hull">'
        + "".join(render_row(r) for r in hull.get("rows") or [])
        + sub_html
        + "</div>"
        + messages(obj.get("failures"), [])
        + "</div>"
    )


def render_layout(section: dict) -> str:
    if section["status"] == "NOT RUN" and not section.get("rows"):
        return '<p class="na">NOT RUN</p>'
    chunks = []
    for block in section.get("blocks") or []:
        if block["kind"] == "error":
            chunks.append(error_card(block))
    if section.get("zone"):
        chunks.append(f'<p class="meta">zone {esc(section["zone"])}</p>')
    if section.get("clearingErr"):
        chunks.append('<p class="na">clearing.json not readable in the layout folder</p>')
    elif section.get("clearingId") is not None or section.get("clearingGates") is not None:
        chunks.append(
            f'<p class="meta">clearing.json id {esc(fmt(section.get("clearingId")))}'
            f' · gates {esc(fmt(section.get("clearingGates")))}</p>'
        )
    if section.get("diagram"):
        chunks.append(f'<figure><img src="{esc(section["diagram"])}" alt="top-down diagram"><figcaption>debug-topdown.png</figcaption></figure>')
    else:
        chunks.append('<p class="na">debug-topdown.png not in the layout folder</p>')
    chunks.append("".join(render_row(r) for r in section.get("rows") or []))
    return "".join(chunks)


def render_play(section: dict) -> str:
    if section["status"] == "NOT RUN" and not section.get("rows"):
        return '<p class="na">NOT RUN</p>'
    chunks = []
    for block in section.get("blocks") or []:
        if block.get("kind") == "error":
            chunks.append(error_card(block))
    video = section.get("video") or {}
    if section.get("videoRel"):
        chunks.append(
            f'<video controls playsinline src="{esc(section["videoRel"])}"></video>'
            f'<p class="meta">{esc(fmt(video.get("width")))}×{esc(fmt(video.get("height")))}'
            f' · {esc(fmt(video.get("fps")))} fps · {esc(fmt(video.get("codec")))}</p>'
        )
    elif section["status"] != "NOT RUN":
        chunks.append('<p class="na">walk.mp4 not found</p>')
    stills = section.get("stills") or []
    if stills:
        figs = []
        for still in stills:
            if still.get("src"):
                figs.append(f'<figure><img src="{esc(still["src"])}" alt="{esc(still["name"])}"><figcaption>{esc(still["name"])}</figcaption></figure>')
            else:
                figs.append(f'<figure><div class="ph">missing</div><figcaption>{esc(still["name"])}</figcaption></figure>')
        chunks.append('<div class="gallery">' + "".join(figs) + "</div>")
    chunks.append("".join(render_row(r) for r in section.get("rows") or []))
    for note in section.get("notes") or []:
        chunks.append(f'<p class="note">{esc(note)}</p>')
    return "".join(chunks)


def render_row(row: dict) -> str:
    extra = "".join(f"<p>{esc(line)}</p>" for line in row.get("extra") or [])
    lines = "".join(f"<p class=\"toolmsg\">{esc(line)}</p>" for line in row.get("lines") or [])
    return (
        "<details>"
        f"<summary>{chip(row['status'])}<span><strong>{esc(row['title'])}</strong> {esc(row['summary'])}</span></summary>"
        f"<p>{esc(row['explain'])}</p>{extra}{lines}"
        "</details>"
    )


def messages(failures, warnings) -> str:
    chunks = []
    for line in failures or []:
        chunks.append(f'<p class="toolmsg">{esc(line)}</p>')
    for line in warnings or []:
        chunks.append(f'<p class="toolmsg warn">{esc(line)}</p>')
    return "".join(chunks)


def error_card(block: dict) -> str:
    return f'<article class="card">{chip(block["status"])}<p>{esc(block["text"])}</p></article>'


def thumb_html(rel: str | None, title: str, is_video: bool) -> str:
    if rel:
        return f'<img class="thumb" src="{esc(rel)}" alt="{esc(title)}">'
    if is_video:
        return '<div class="ph">video</div>'
    return '<div class="ph">no still</div>'


def chip(status: str) -> str:
    label = {"n/a": "n/a", "NOT RUN": "NOT RUN", "SKIP": "SKIP"}.get(status, status)
    cls = {"NOT RUN": "NOTRUN", "SKIP": "SKIP", "n/a": "NA", "PASS": "PASS", "WARN": "WARN", "FAIL": "FAIL", "INCOMPLETE": "INCOMPLETE"}.get(status, "NA")
    return f'<span class="chip {cls}">{esc(label)}</span>'


def esc(value) -> str:
    return html.escape(str(value), quote=True)


CSS = """
:root { color-scheme: light; }
* { box-sizing: border-box; }
html { font-size: 16px; }
body { margin: 0; background: #f3f1ec; color: #1c1915; font-family: system-ui, sans-serif; line-height: 1.45; }
.wrap { max-width: 430px; margin: 0 auto; padding: 16px 14px 48px; }
h1 { font-size: 1.45rem; line-height: 1.2; margin: 0 0 4px; }
h2 { font-size: 1.2rem; margin: 22px 0 6px; }
h3 { font-size: 1rem; margin: 0 0 4px; word-break: break-word; }
h4 { font-size: 0.95rem; margin: 12px 0 4px; }
.kicker { margin: 0; letter-spacing: 0.04em; text-transform: uppercase; font-size: 0.75rem; color: #5e584f; }
.date { margin: 0 0 8px; color: #5e584f; }
.play { display: block; margin: 12px 0 0; word-break: break-all; color: #143d66; font-size: 1rem; }
.counts { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-top: 8px; }
.count { display: inline-flex; align-items: center; gap: 4px; }
nav { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0; }
nav a { color: #143d66; background: #fff; border-radius: 999px; padding: 8px 12px; text-decoration: none; }
.card, .object { background: #fff; border-radius: 14px; padding: 12px; margin: 10px 0; }
.object + .object { margin-top: 14px; }
.assethead, .view { display: flex; gap: 10px; align-items: flex-start; }
.view { padding-top: 10px; border-top: 1px solid #eee; }
.thumb, .ph { width: 72px; height: 72px; flex: 0 0 72px; border-radius: 8px; object-fit: contain; background: #211f1c; color: #f3f1ec; }
.ph { display: flex; align-items: center; justify-content: center; font-size: 0.75rem; text-align: center; }
img, video { max-width: 100%; height: auto; border-radius: 8px; }
video { width: 100%; background: #111; }
figure { margin: 8px 0; }
figcaption, .meta, .tool, .note, .foot, .lock { color: #5e584f; font-size: 0.92rem; }
.lock { color: #7a4b00; margin: 4px 0 0; }
.chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-weight: 700; font-size: 0.78rem; letter-spacing: 0.02em; vertical-align: middle; }
.chip.PASS { background: #d7f3df; color: #0d5c2e; }
.chip.WARN { background: #ffe3b3; color: #7a4b00; }
.chip.FAIL { background: #ffd0d0; color: #8d1212; }
.chip.NOTRUN, .chip.SKIP, .chip.NA { background: #e6e2da; color: #5c5852; }
.chip.INCOMPLETE { background: #e6e2da; color: #3f3a34; }
details { border-top: 1px solid #eee; }
summary { padding: 12px 0; cursor: pointer; display: flex; gap: 8px; align-items: flex-start; }
summary span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
details p { margin: 0 0 8px; }
.gallery, .views { display: flex; flex-direction: column; gap: 8px; }
.toolmsg { font-size: 0.92rem; }
.toolmsg.warn { color: #7a4b00; }
.na { color: #5c5852; background: #e6e2da; border-radius: 8px; padding: 8px 10px; }
ul { padding-left: 18px; margin: 4px 0; }
"""


if __name__ == "__main__":
    sys.exit(main())
