"""Mock runs, error isolation, and adapter selection."""

import json

import pytest

from boltverse_orchestrator import (
    CommandAdapter,
    MockAdapter,
    Part,
    StubAdapter,
    adapter_for,
    route,
    run_plan,
)
from boltverse_orchestrator.adapters import mock_output, subprocess
from boltverse_orchestrator.registry import registry_from_dict

from paths import REGISTRY_PATH


def _ai(ai_id, family, status="validated", cpu=0.1, output="o (4,): demo"):
    return {
        "id": ai_id,
        "family": family,
        "status_class": status,
        "checkpoint": f"/weights/{ai_id}/best.npz",
        "entry_point": "score.py",
        "input": "a crop",
        "output": output,
        "cpu_s_per_call": cpu,
    }


def _reg(*rows):
    return registry_from_dict({"count": len(rows), "ais": list(rows)})


class Boom:
    def load(self):
        return None

    def run(self, payload):
        raise RuntimeError("boom on this part")


class BadType:
    def load(self):
        return None

    def run(self, payload):
        return ["not", "a", "dict"]


def test_mock_output_shape_uses_numpy_and_marks_placeholders():
    from boltverse_orchestrator import load_registry

    reg = load_registry(REGISTRY_PATH)
    barrel = mock_output(reg.get("barrel-B2"))
    assert barrel["_mock"] is True
    assert barrel["placeholder"] is True
    assert barrel["raw_head_shape"] == [35]
    assert barrel["raw_head_dtype"] == "float64"
    assert len(barrel["raw_head"]) == 35
    assert all(value is None for value in barrel["raw_head"])
    assert "hoops" in barrel
    shape = mock_output(reg.get("plinth-shape-v2"))
    assert len(shape["raw_head"]) == 15
    camera = mock_output(reg.get("plinth-camera-v1"))
    assert len(camera["raw_head"]) == 4
    texture = mock_output(reg.get("texture-box"))
    assert len(texture["raw_head"]) == 3075
    assert "mean_rgb" in texture
    door = mock_output(reg.get("door-D1"))
    assert len(door["raw_head"]) == 42
    assert "straps" in door


def test_mock_run_on_two_parts_and_a_gap():
    reg = _reg(_ai("fast", "gadget"), _ai("other", "widget"))
    plan = route(
        [Part("a", "gadget", {"x": 1}), Part("missing", "engine"), Part("b", "widget")],
        reg,
    )
    report = run_plan(plan, mock=True)
    assert [item.status for item in report.parts] == ["ok", "no_ai", "ok"]
    assert report.no_ai == ["missing"]
    assert report.parts[0].result["_mock"] is True
    assert report.parts[0].result["ai_id"] == "fast"
    assert report.parts[0].result["payload_ignored"] is True
    assert report.parts[0].seconds >= 0
    assert "NO AI YET" in report.summary
    assert report.to_dict()["n_ok"] == 2
    assert report.to_dict()["n_no_ai"] == 1


def test_one_failure_does_not_abort_the_others():
    reg = _reg(_ai("a", "alpha"), _ai("b", "beta"), _ai("c", "gamma"))
    plan = route(
        [
            Part("first", "alpha"),
            Part("second", "beta"),
            Part("third", "gamma"),
            Part("gap", "engine"),
        ],
        reg,
    )
    report = run_plan(plan, adapters={"b": Boom()}, mock=True)
    assert [item.status for item in report.parts] == ["ok", "error", "ok", "no_ai"]
    assert report.parts[0].result["_mock"] is True
    assert report.parts[2].result["_mock"] is True
    assert "boom on this part" in report.parts[1].error
    assert report.parts[1].result is None
    assert report.no_ai == ["gap"]
    assert "error" in report.summary

    typed = run_plan(plan, adapters={"b": BadType()}, mock=True)
    assert typed.parts[1].status == "error"
    assert "dict" in typed.parts[1].error
    assert typed.parts[0].status == "ok"
    assert typed.parts[2].status == "ok"


def test_stub_for_unknown_kind_and_known_but_unshipped_kind():
    reg = _reg(
        _ai("barrel-B2", "barrel"),
        _ai("mystery", "engine-core"),
    )
    known = adapter_for(reg.get("barrel-B2"), mock=False)
    assert isinstance(known, StubAdapter)
    with pytest.raises(NotImplementedError, match="barrel-B2"):
        known.run({})
    with pytest.raises(NotImplementedError, match="numpy-barrel-net"):
        known.load()
    unknown = adapter_for(reg.get("mystery"), mock=False)
    assert isinstance(unknown, StubAdapter)
    with pytest.raises(NotImplementedError, match="unknown"):
        unknown.run(None)
    mocked = adapter_for(reg.get("mystery"), mock=True)
    assert isinstance(mocked, MockAdapter)
    assert mocked.run(None)["_mock"] is True


def test_command_adapter_builds_argv_without_executing(monkeypatch):
    def explode(*args, **kwargs):
        raise AssertionError("subprocess.run must not be called")

    monkeypatch.setattr(subprocess, "run", explode)
    reg = _reg(_ai("barrel-B2", "barrel", output="o (35): hoops"))
    entry = reg.get("barrel-B2")
    adapter = CommandAdapter(
        entry,
        "python3 score.py --checkpoint {checkpoint} --payload {payload}",
    )
    adapter.load()
    argv = adapter.argv_for({"crop": "a b", "n": 1})
    assert argv[0] == "python3"
    assert argv[1] == "score.py"
    assert "--checkpoint" in argv
    assert entry.checkpoint in argv
    payload = json.loads(argv[argv.index("--payload") + 1])
    assert payload["crop"] == "a b"
    assert adapter.loaded is True


def test_command_adapter_run_uses_the_patched_process(monkeypatch):
    captured = {}

    class Finished:
        returncode = 0
        stdout = '{"n": 3, "lid": false}\n'
        stderr = ""

    def fake_run(argv, **kwargs):
        captured["argv"] = argv
        captured["kwargs"] = kwargs
        return Finished()

    monkeypatch.setattr(subprocess, "run", fake_run)
    reg = _reg(_ai("barrel-B2", "barrel"))
    adapter = CommandAdapter(reg.get("barrel-B2"), "python3 score.py --id {ai_id}")
    result = adapter.run({"ok": True})
    assert result == {"n": 3, "lid": False}
    assert captured["argv"] == ["python3", "score.py", "--id", "barrel-B2"]
    assert captured["kwargs"].get("shell") is not True
    assert captured["kwargs"]["check"] is False


def test_mock_false_records_stub_errors_and_continues():
    reg = _reg(_ai("a", "alpha"), _ai("b", "beta"))
    plan = route([Part("first", "alpha"), Part("second", "beta")], reg)
    report = run_plan(plan, mock=False)
    assert [item.status for item in report.parts] == ["error", "error"]
    assert "NotImplementedError" in report.parts[0].error
    assert "NotImplementedError" in report.parts[1].error
    assert "numpy-legacy" not in report.parts[0].error
