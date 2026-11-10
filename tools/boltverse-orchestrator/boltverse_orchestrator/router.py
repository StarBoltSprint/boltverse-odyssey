"""Choose at most one AI per part.

Several matches: validated beats in_progress, then lower CPU time, then
earlier registry order. The rest of the routable matches are alternatives.
Entries that must not run are listed with a plain reason. A part type with
no routable AI is marked NO AI YET — this module never invents an AI.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .registry import AIEntry, Registry, refusal_reason

NO_AI_YET = "NO AI YET"


@dataclass(frozen=True)
class Part:
    name: str
    part_type: str
    payload: Any = None

    @staticmethod
    def from_dict(row: dict) -> "Part":
        if not isinstance(row, dict):
            raise ValueError("each part must be an object")
        name = row.get("name")
        part_type = row.get("part_type", row.get("type"))
        if not isinstance(name, str) or not name.strip():
            raise ValueError("each part needs a non-empty name")
        if not isinstance(part_type, str) or not part_type.strip():
            raise ValueError(f"part {name!r} needs a part_type")
        if "payload" in row:
            payload = row["payload"]
        else:
            payload = row.get("input")
        return Part(name=name.strip(), part_type=part_type.strip(), payload=payload)


@dataclass(frozen=True)
class RouteDecision:
    part: Part
    ai: AIEntry | None
    why: str
    input_interface: str | None
    output_interface: str | None
    alternatives: tuple[AIEntry, ...] = ()
    refused: tuple[tuple[AIEntry, str], ...] = ()
    marker: str | None = None

    @property
    def no_ai_yet(self) -> bool:
        return self.marker == NO_AI_YET


@dataclass(frozen=True)
class Plan:
    decisions: tuple[RouteDecision, ...]
    allow_unvalidated: bool
    registry_source: str = ""
    summary: str = ""

    def to_dict(self) -> dict:
        return {
            "summary": self.summary,
            "allow_unvalidated": self.allow_unvalidated,
            "registry": self.registry_source,
            "parts": [decision_to_dict(item) for item in self.decisions],
        }


def decision_to_dict(item: RouteDecision) -> dict:
    ai = item.ai
    return {
        "name": item.part.name,
        "part_type": item.part.part_type,
        "ai": None if ai is None else ai.id,
        "ai_name": None if ai is None else ai.name,
        "why": item.why,
        "input": item.input_interface,
        "output": item.output_interface,
        "marker": item.marker,
        "alternatives": [
            {
                "id": alt.id,
                "status": alt.status,
                "cpu_s_per_call": alt.cpu_s_per_call,
                "name": alt.name,
            }
            for alt in item.alternatives
        ],
        "refused": [
            {"id": refused.id, "status": refused.status, "reason": reason}
            for refused, reason in item.refused
        ],
    }


def _cpu_key(ai: AIEntry) -> float:
    # A missing timing is not a fast AI. It sorts after every recorded time.
    if ai.cpu_s_per_call is None:
        return float("inf")
    return ai.cpu_s_per_call


def _rank(ai: AIEntry) -> int:
    if ai.status == "validated":
        return 0
    if ai.status == "in_progress":
        return 1
    return 2


def _why_chosen(chosen: AIEntry, alternatives: tuple[AIEntry, ...]) -> str:
    if chosen.cpu_s_per_call is None:
        cpu = "CPU time not recorded"
    else:
        cpu = f"CPU {chosen.cpu_s_per_call:g} s/call"
    if not alternatives:
        return f"{chosen.status}; {cpu}; only routable AI"
    others = ", ".join(alt.id for alt in alternatives)
    return f"{chosen.status}; {cpu}; preferred over {others}"


def _decide(part: Part, registry: Registry, *, allow_unvalidated: bool) -> RouteDecision:
    matches = registry.matches(part.part_type)
    refused: list[tuple[AIEntry, str]] = []
    routable: list[AIEntry] = []
    for ai in matches:
        reason = refusal_reason(ai, allow_unvalidated=allow_unvalidated)
        if reason is None:
            routable.append(ai)
        else:
            refused.append((ai, reason))
    refused_t = tuple(refused)
    if not routable:
        if not matches:
            why = f"{NO_AI_YET}. No registry entry for part type {part.part_type!r}."
        else:
            why = f"{NO_AI_YET}. No routable AI for part type {part.part_type!r}."
        return RouteDecision(
            part=part,
            ai=None,
            why=why,
            input_interface=None,
            output_interface=None,
            alternatives=(),
            refused=refused_t,
            marker=NO_AI_YET,
        )
    ordered = tuple(
        ai
        for _, ai in sorted(
            enumerate(routable),
            key=lambda pair: (_rank(pair[1]), _cpu_key(pair[1]), pair[0]),
        )
    )
    chosen = ordered[0]
    alternatives = ordered[1:]
    return RouteDecision(
        part=part,
        ai=chosen,
        why=_why_chosen(chosen, alternatives),
        input_interface=chosen.input,
        output_interface=chosen.output,
        alternatives=alternatives,
        refused=refused_t,
        marker=None,
    )


def format_plan(plan: Plan) -> str:
    lines = [
        f"Orchestrator plan — {len(plan.decisions)} part(s)"
        f" (allow_unvalidated={str(plan.allow_unvalidated).lower()})."
    ]
    missing = [item.part.part_type for item in plan.decisions if item.no_ai_yet]
    if missing:
        lines.append("No AI yet: " + ", ".join(missing) + ".")
    for item in plan.decisions:
        label = f"{item.part.name} ({item.part.part_type})"
        if item.no_ai_yet:
            lines.append(f"- {label}: {item.why}")
        else:
            assert item.ai is not None
            lines.append(f"- {label}: {item.ai.id}. {item.why}")
            for alt in item.alternatives:
                cpu = "CPU not recorded" if alt.cpu_s_per_call is None else f"CPU {alt.cpu_s_per_call:g}s"
                lines.append(f"  alternative: {alt.id} ({alt.status}, {cpu})")
        for ai, reason in item.refused:
            lines.append(f"  not routed: {ai.id} ({reason})")
    return "\n".join(lines)


class Router:
    """Chief bound to one registry. `route` takes only the part list."""

    def __init__(self, registry: Registry, *, allow_unvalidated: bool = False):
        self.registry = registry
        self.allow_unvalidated = allow_unvalidated

    def route(self, parts: list[Part]) -> Plan:
        decisions = tuple(
            _decide(part, self.registry, allow_unvalidated=self.allow_unvalidated)
            for part in parts
        )
        plan = Plan(
            decisions=decisions,
            allow_unvalidated=self.allow_unvalidated,
            registry_source=self.registry.source,
        )
        text = format_plan(plan)
        return Plan(
            decisions=decisions,
            allow_unvalidated=self.allow_unvalidated,
            registry_source=self.registry.source,
            summary=text,
        )


def route(
    parts: list[Part],
    registry: Registry,
    *,
    allow_unvalidated: bool = False,
) -> Plan:
    """Route each part. The registry is an argument because v0 has no global one."""
    return Router(registry, allow_unvalidated=allow_unvalidated).route(parts)


def load_parts(path: str | Path) -> list[Part]:
    src = Path(path)
    with src.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, dict):
        if "parts" not in data:
            raise ValueError("parts file object must contain a 'parts' list")
        data = data["parts"]
    if not isinstance(data, list):
        raise ValueError("parts file must be a list or an object with a parts list")
    return [Part.from_dict(row) for row in data]
