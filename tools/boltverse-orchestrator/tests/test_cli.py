"""CLI smoke test. No network, no weight files."""

import json
import os
import subprocess
import sys

from paths import PARTS_PATH, REGISTRY_PATH, ROOT


def _run(args, out_dir):
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT) + os.pathsep + env.get("PYTHONPATH", "")
    return subprocess.run(
        [sys.executable, "-m", "boltverse_orchestrator", *args],
        cwd=out_dir,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_plan_and_mock_run(tmp_path):
    plan_path = tmp_path / "plan.json"
    plan = _run(
        [
            "plan",
            "--registry",
            str(REGISTRY_PATH),
            "--parts",
            str(PARTS_PATH),
            "--out",
            str(plan_path),
        ],
        tmp_path,
    )
    assert plan.returncode == 0, plan.stderr
    assert "NO AI YET" in plan.stdout
    assert "barrel-B2" in plan.stdout
    assert "plinth-shape-v2" in plan.stdout
    assert "engine" in plan.stdout
    body = json.loads(plan_path.read_text(encoding="utf-8"))
    by_type = {row["part_type"]: row for row in body["parts"]}
    assert by_type["engine"]["marker"] == "NO AI YET"
    assert by_type["engine"]["ai"] is None
    assert by_type["wing"]["marker"] == "NO AI YET"
    assert by_type["antenna"]["marker"] == "NO AI YET"
    assert by_type["hull/body"]["marker"] == "NO AI YET"
    assert by_type["barrel"]["ai"] == "barrel-B2"
    assert by_type["barrel"]["input"]
    assert by_type["barrel"]["output"]
    assert by_type["door"]["marker"] == "NO AI YET"
    assert by_type["plinth"]["ai"] == "plinth-shape-v2"
    assert by_type["plinth"]["alternatives"][0]["id"] == "plinth-camera-v1"
    assert "summary" in body

    report_path = tmp_path / "report.json"
    run = _run(
        [
            "run",
            "--registry",
            str(REGISTRY_PATH),
            "--parts",
            str(PARTS_PATH),
            "--mock",
            "--out",
            str(report_path),
        ],
        tmp_path,
    )
    assert run.returncode == 0, run.stderr
    assert "NO AI YET" in run.stdout
    assert "(mock)" in run.stdout
    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert report["mock"] is True
    assert report["n_ok"] == 2
    assert report["n_error"] == 0
    assert set(report["no_ai"]) == {
        "hull",
        "port-wing",
        "main-engine",
        "mast-antenna",
        "cabin-door",
    }
    rows = {row["name"]: row for row in report["parts"]}
    assert rows["water-barrel"]["status"] == "ok"
    assert rows["water-barrel"]["result"]["_mock"] is True
    assert rows["water-barrel"]["ai_id"] == "barrel-B2"
    assert len(rows["water-barrel"]["result"]["raw_head"]) == 35
    assert rows["bow-plinth"]["result"]["_mock"] is True
    assert rows["main-engine"]["status"] == "no_ai"
    assert rows["water-barrel"]["seconds"] >= 0


def test_cli_bad_registry_is_a_clean_error(tmp_path):
    missing = tmp_path / "nope.json"
    proc = _run(
        ["plan", "--registry", str(missing), "--parts", str(PARTS_PATH), "--out", str(tmp_path / "x.json")],
        tmp_path,
    )
    assert proc.returncode == 1
    assert "error:" in proc.stderr
    assert not (tmp_path / "x.json").exists()
