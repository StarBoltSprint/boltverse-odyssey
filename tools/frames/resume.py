"""Progress file for a long frame scan. A finished step is skipped on --resume."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone


def empty():
    return {"done": [], "left": [], "rows": [], "updated": None}


def load(path: str) -> dict:
    if not path or not os.path.isfile(path):
        return empty()
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
    data.setdefault("done", [])
    data.setdefault("left", [])
    data.setdefault("rows", [])
    return data


def save(path: str, state: dict) -> None:
    if not path:
        return
    state["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    folder = os.path.dirname(path)
    if folder:
        os.makedirs(folder, exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2)
        handle.write("\n")
    os.replace(tmp, path)


def mark(state: dict, step_id: str, row: dict, left: list[str]) -> None:
    done = [item for item in state["done"] if item != step_id]
    done.append(step_id)
    state["done"] = done
    state["left"] = [item for item in left if item not in done]
    rows = [item for item in state["rows"] if item.get("id") != step_id]
    rows.append(row)
    state["rows"] = rows
