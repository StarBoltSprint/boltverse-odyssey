"""Run a plan one part at a time and write a short report.

One part's failure is recorded and the next part still runs.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

from .adapters import Adapter, adapter_for
from .registry import load_registry
from .router import NO_AI_YET, Plan, format_plan, load_parts, route


@dataclass(frozen=True)
class PartResult:
    name: str
    part_type: str
    status: str
    ai_id: str | None
    seconds: float
    result: dict | None
    error: str | None
    no_ai_yet: bool

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "part_type": self.part_type,
            "status": self.status,
            "ai_id": self.ai_id,
            "seconds": self.seconds,
            "result": self.result,
            "error": self.error,
            "no_ai_yet": self.no_ai_yet,
        }


@dataclass(frozen=True)
class Report:
    parts: tuple[PartResult, ...]
    mock: bool
    summary: str = ""

    @property
    def no_ai(self) -> list[str]:
        return [item.name for item in self.parts if item.no_ai_yet]

    def to_dict(self) -> dict:
        return {
            "summary": self.summary,
            "mock": self.mock,
            "no_ai": self.no_ai,
            "n_ok": sum(item.status == "ok" for item in self.parts),
            "n_error": sum(item.status == "error" for item in self.parts),
            "n_no_ai": sum(item.status == "no_ai" for item in self.parts),
            "parts": [item.to_dict() for item in self.parts],
        }


def format_report(report: Report) -> str:
    n_ok = sum(item.status == "ok" for item in report.parts)
    n_err = sum(item.status == "error" for item in report.parts)
    n_no = sum(item.status == "no_ai" for item in report.parts)
    lines = [
        f"Orchestrator run — {n_ok} ok, {n_err} error(s), {n_no} with no AI."
    ]
    missing = [item.part_type for item in report.parts if item.no_ai_yet]
    if missing:
        lines.append("No AI yet: " + ", ".join(missing) + ".")
    for item in report.parts:
        label = f"{item.name} ({item.part_type})"
        if item.status == "no_ai":
            lines.append(f"- {label}: {NO_AI_YET}.")
        elif item.status == "ok":
            mocked = ""
            if isinstance(item.result, dict) and item.result.get("_mock") is True:
                mocked = " (mock)"
            lines.append(
                f"- {label}: ok via {item.ai_id}{mocked} in {item.seconds:.4f}s."
            )
        else:
            lines.append(f"- {label}: error via {item.ai_id}: {item.error}")
    return "\n".join(lines)


def run_plan(
    plan: Plan,
    adapters: Mapping[str, Adapter] | None = None,
    *,
    mock: bool = True,
) -> Report:
    """Execute each routed part in order.

    `adapters` is keyed by AI id. A provided adapter is used as-is.
    Missing ids use MockAdapter when mock is true, otherwise the stub
    (or CommandAdapter when the caller already put one in the map).
    """
    provided = dict(adapters or {})
    results: list[PartResult] = []
    for decision in plan.decisions:
        started = time.perf_counter()
        if decision.ai is None:
            results.append(
                PartResult(
                    name=decision.part.name,
                    part_type=decision.part.part_type,
                    status="no_ai",
                    ai_id=None,
                    seconds=time.perf_counter() - started,
                    result=None,
                    error=None,
                    no_ai_yet=True,
                )
            )
            continue
        ai_id = decision.ai.id
        adapter = provided.get(ai_id)
        if adapter is None:
            adapter = adapter_for(decision.ai, mock=mock)
        try:
            adapter.load()
            result = adapter.run(decision.part.payload)
            if not isinstance(result, dict):
                raise TypeError(
                    f"adapter for {ai_id} returned {type(result).__name__}, expected dict"
                )
            results.append(
                PartResult(
                    name=decision.part.name,
                    part_type=decision.part.part_type,
                    status="ok",
                    ai_id=ai_id,
                    seconds=time.perf_counter() - started,
                    result=result,
                    error=None,
                    no_ai_yet=False,
                )
            )
        except Exception as exc:  # one part must not abort the run
            results.append(
                PartResult(
                    name=decision.part.name,
                    part_type=decision.part.part_type,
                    status="error",
                    ai_id=ai_id,
                    seconds=time.perf_counter() - started,
                    result=None,
                    error=f"{type(exc).__name__}: {exc}",
                    no_ai_yet=False,
                )
            )
    report = Report(parts=tuple(results), mock=mock)
    return Report(parts=report.parts, mock=mock, summary=format_report(report))


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def _add_common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--registry", required=True, help="path to AI-REGISTRY.json")
    parser.add_argument("--parts", required=True, help="path to a parts JSON file")
    parser.add_argument("--out", help="JSON output path")
    parser.add_argument(
        "--allow-unvalidated",
        action="store_true",
        help="also route in_progress AIs (failed / superseded / missing weights stay closed)",
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="boltverse_orchestrator",
        description="Route parts to in-house Boltverse AIs (v0, no weight loading).",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)
    plan_parser = sub.add_parser("plan", help="choose an AI per part and write the plan")
    _add_common(plan_parser)
    run_parser = sub.add_parser("run", help="execute a plan (use --mock on this machine)")
    _add_common(run_parser)
    run_parser.add_argument(
        "--mock",
        action="store_true",
        help="fill documented output shapes with placeholders; do not call a real AI",
    )
    args = parser.parse_args(argv)
    try:
        registry = load_registry(args.registry)
        parts = load_parts(args.parts)
    except (OSError, ValueError, json.JSONDecodeError, KeyError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    plan = route(parts, registry, allow_unvalidated=args.allow_unvalidated)
    if args.cmd == "plan":
        text = plan.summary or format_plan(plan)
        out = Path(args.out) if args.out else Path("plan.json")
        _write_json(out, plan.to_dict())
        print(text)
        print(f"wrote {out}")
        return 0
    report = run_plan(plan, mock=bool(args.mock))
    out = Path(args.out) if args.out else Path("report.json")
    _write_json(out, report.to_dict())
    print(report.summary)
    print(f"wrote {out}")
    return 0
