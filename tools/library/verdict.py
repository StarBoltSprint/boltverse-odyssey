"""Read assetcheck / objsheet / walkaround reports. Does not measure pixels."""

from __future__ import annotations

import json
from pathlib import Path


class ReportRejected(RuntimeError):
    pass


def load_report(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ReportRejected(f"{path} is not a report object")
    return data


def judge_assetcheck(report: dict) -> tuple[str, list[str]]:
    """PASS, or WARN when the only misses are lock/ grandfather notes. FAIL rejects the add."""
    notes: list[str] = []
    locked_notes: list[str] = []
    fails: list[str] = []
    assets = report.get("assets") or []
    if not isinstance(assets, list):
        return "FAIL", ["assets is not a list"]
    for asset in assets:
        if not isinstance(asset, dict):
            fails.append("asset entry is not an object")
            continue
        locked = _locked(asset)
        checks = asset.get("checks") or {}
        if not isinstance(checks, dict):
            fails.append(f"{asset.get('file')} checks is not an object")
            continue
        for name, chk in checks.items():
            status = str((chk or {}).get("status") or "")
            if status in ("FAIL", "WARN") and locked:
                locked_notes.append(f"WARN {asset.get('file')} {name} (lock)")
            elif status == "WARN":
                notes.append(f"WARN {asset.get('file')} {name}")
            elif status == "FAIL":
                fails.append(f"FAIL {asset.get('file')} {name}")
            elif status and status != "PASS":
                fails.append(f"{asset.get('file')} {name} status {status}")
    if fails:
        return "FAIL", fails
    if report.get("ok") is True:
        both = notes + locked_notes
        return ("WARN", both) if both else ("PASS", [])
    if locked_notes and not notes:
        return "WARN", locked_notes
    return "FAIL", ["ok is false"]


def judge_objsheet(report: dict) -> tuple[str, list[str]]:
    if report.get("ok") is True:
        return "PASS", []
    return "FAIL", ["ok is not true"]


def judge_walkaround(report: dict) -> tuple[str, list[str]]:
    if report.get("ok") is not True:
        return "FAIL", ["ok is not true"]
    overs = []
    for mag in _mags(report):
        if mag > 1.0 + 1e-6:
            overs.append(mag)
    if overs:
        return "FAIL", [f"maxMagnification {max(overs)} > 1"]
    return "PASS", []


def accept(kind: str, report: dict) -> tuple[str, list[str]]:
    if kind == "assetcheck":
        verdict, notes = judge_assetcheck(report)
    elif kind == "objsheet":
        verdict, notes = judge_objsheet(report)
    elif kind == "walkaround":
        verdict, notes = judge_walkaround(report)
    else:
        raise ReportRejected(f"unknown report kind {kind}")
    if verdict == "FAIL":
        raise ReportRejected(kind + ": " + "; ".join(notes))
    return verdict, notes


def _locked(asset: dict) -> bool:
    if asset.get("locked") is True:
        return True
    file = str(asset.get("file") or "").replace("\\", "/")
    parts = file.split("/")
    return "lock" in parts


def _mags(node) -> list[float]:
    found: list[float] = []
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "maxMagnification" and isinstance(value, (int, float)):
                found.append(float(value))
            else:
                found.extend(_mags(value))
    elif isinstance(node, list):
        for value in node:
            found.extend(_mags(value))
    return found


def rel_to_repo(path: Path, repo: Path) -> str:
    try:
        return path.resolve().relative_to(repo.resolve()).as_posix()
    except ValueError:
        return path.as_posix()
