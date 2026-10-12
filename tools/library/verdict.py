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


def judge_gate(report: dict) -> tuple[str, list[str]]:
    """PASS, or WARN when the only misses are a grandfathered lock. FAIL rejects the add.

    A headline PASS does not hide a FAIL row. Lock WARN grandfathering matches assetcheck:
    locked: true, or a lock/ path, may store WARN. Any other FAIL is refused.
    """
    locked = _gate_locked(report)
    notes: list[str] = []
    fails: list[str] = []
    for row in _gate_rows(report):
        status = str(row.get("status") or row.get("verdict") or "")
        label = str(row.get("check") or row.get("id") or row.get("name") or "row")
        row_locked = locked or row.get("locked") is True or _locked(row)
        if status == "FAIL" and row_locked:
            notes.append(f"WARN {label} (lock)")
        elif status == "FAIL":
            fails.append(f"FAIL {label}")
        elif status == "WARN" and not row_locked:
            notes.append(f"WARN {label}")
    verdict = str(report.get("verdict") or "")
    if report.get("ok") is False and not locked:
        fails.append("ok is false")
    if verdict == "FAIL" and not locked:
        fails.append("verdict FAIL")
    if fails:
        return "FAIL", fails
    if locked and (verdict == "WARN" or notes or report.get("ok") is not True):
        return "WARN", notes or ["lock grandfather"]
    if report.get("ok") is True or verdict == "PASS":
        return ("WARN", notes) if notes else ("PASS", [])
    if verdict == "WARN" and locked:
        return "WARN", notes or ["lock grandfather"]
    return "FAIL", ["gate report has no PASS"]


def accept(kind: str, report: dict) -> tuple[str, list[str]]:
    if kind == "assetcheck":
        verdict, notes = judge_assetcheck(report)
    elif kind == "objsheet":
        verdict, notes = judge_objsheet(report)
    elif kind == "walkaround":
        verdict, notes = judge_walkaround(report)
    elif kind == "gate":
        verdict, notes = judge_gate(report)
    else:
        raise ReportRejected(f"unknown report kind {kind}")
    if verdict == "FAIL":
        raise ReportRejected(kind + ": " + "; ".join(notes))
    return verdict, notes


def _gate_locked(report: dict) -> bool:
    if report.get("locked") is True:
        return True
    return _locked(report)


def _gate_rows(report: dict) -> list[dict]:
    rows = report.get("rows")
    if rows is None:
        rows = report.get("checks")
    if isinstance(rows, dict):
        out = []
        for key, value in rows.items():
            if isinstance(value, dict):
                out.append({"name": key, **value})
            else:
                out.append({"name": key, "status": value})
        return out
    if isinstance(rows, list):
        return [row for row in rows if isinstance(row, dict)]
    return []


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
