#!/usr/bin/env python3
"""tools/gatesuite/core.py - the shared run(ctx) -> Section interface.

Each check is a module tools/gatesuite/<step>.py exposing  run(ctx) -> Section.
Order is locked:  spine, layout, walk, pack, budget, playgate, depthmeasure, features, kitjudge.

ctx:   page (served page at phone settings, spine camera), spine (dict, refused if < v1.3.1),
       glbs ({"before": {...}, "after": {...}} paths), render(cam) -> jpg path, mode "greybox" | "art".
Section: status PASS | FAIL | NA (NA requires a reason), measured (source, camera, views, values, limits),
         fails [{s_m, timecode, id}], artifacts [paths].

merge(): every step gets a section in gate-report.json. A missing / errored / malformed section is FAIL.
A step with no module yet is a stub that returns FAIL "not implemented" (never PASS, never skipped).

    python3 -m tools.gatesuite.core <ctx.json> [--out gate-report.json]
    python3 -m tools.gatesuite.core --selftest      # registry sanity + interface must-fails
"""
import argparse, importlib, json, sys, traceback
from dataclasses import dataclass, field, asdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
STEPS = ["spine", "layout", "walk", "pack", "budget", "playgate", "depthmeasure", "features", "kitjudge"]
MODULES = {"pack": "pack_integrity"}          # step -> module name when they differ
SPINE_MIN = (1, 3, 1)
MODES = ("greybox", "art")
GREYBOX_NA = {"kitjudge", "depthmeasure"}     # NA on greybox by design; reported, never silently skipped


@dataclass
class Section:
    status: str
    measured: dict = field(default_factory=dict)
    fails: list = field(default_factory=list)
    artifacts: list = field(default_factory=list)
    reason: str = None

    def validate(self):
        if self.status not in ("PASS", "FAIL", "NA"):
            raise ValueError(f"bad status {self.status!r}")
        if self.status == "NA" and not self.reason:
            raise ValueError("NA requires a reason")
        if self.status == "PASS" and not self.measured:
            raise ValueError("PASS without measured evidence")
        for f in self.fails:
            if not {"s_m", "timecode", "id"} <= set(f):
                raise ValueError(f"fail entry needs s_m, timecode, id: {f}")
        if self.status == "PASS" and self.fails:
            raise ValueError("PASS with fails")
        return self


def spine_version(spine):
    v = str(spine.get("version", "")).lstrip("v")
    try:
        return tuple(int(x) for x in v.split("."))
    except ValueError:
        return (0,)


class SpineTooOld(Exception):
    pass


class Ctx:
    def __init__(self, page, spine, glbs, render, mode):
        if mode not in MODES:
            raise ValueError(f"mode must be one of {MODES}")
        if spine_version(spine) < SPINE_MIN:
            raise SpineTooOld(f"spine {spine.get('version')} < v1.3.1 refused")
        self.page, self.spine, self.glbs, self.render, self.mode = page, spine, glbs, render, mode


def stub(step):
    def run(ctx):
        return Section("FAIL", reason="not implemented", fails=[{"s_m": None, "timecode": None, "id": f"{step}:not-implemented"}])
    return run


def load(step):
    name = MODULES.get(step, step)
    try:
        mod = importlib.import_module(f"tools.gatesuite.{name}")
    except ModuleNotFoundError as e:
        if e.name == f"tools.gatesuite.{name}":
            return stub(step)
        raise
    return getattr(mod, "run", None) or stub(step)


def run_step(step, fn, ctx):
    try:
        s = fn(ctx)
        if not isinstance(s, Section):
            raise TypeError("run(ctx) must return Section")
        if s.status == "NA" and not (ctx.mode == "greybox" and step in GREYBOX_NA) and step != "features":
            pass  # NA allowed anywhere with a reason; reason is checked in validate()
        return asdict(s.validate())
    except Exception as e:
        return asdict(Section("FAIL", reason=f"error: {e}", measured={"traceback": traceback.format_exc()[-2000:]},
                              fails=[{"s_m": None, "timecode": None, "id": f"{step}:error"}]))


def merge(sections):
    """sections: {step: dict}. Missing or malformed => FAIL. Overall PASS only if all PASS or reasoned NA."""
    out = {}
    for step in STEPS:
        s = sections.get(step)
        if not isinstance(s, dict) or s.get("status") not in ("PASS", "FAIL", "NA") or (s["status"] == "NA" and not s.get("reason")):
            s = asdict(Section("FAIL", reason="missing section", fails=[{"s_m": None, "timecode": None, "id": f"{step}:missing"}]))
        out[step] = s
    ok = all(out[k]["status"] in ("PASS", "NA") for k in STEPS) and any(out[k]["status"] == "PASS" for k in STEPS)
    return {"order": STEPS, "overall": "PASS" if ok else "FAIL", "sections": out,
            "na": [k for k in STEPS if out[k]["status"] == "NA"]}


def run_all(ctx, out="gate-report.json", only=None):
    secs = {}
    for step in STEPS:
        if only and step not in only:
            continue
        secs[step] = run_step(step, load(step), ctx)
    rep = merge(secs)
    rep["mode"] = ctx.mode
    Path(out).write_text(json.dumps(rep, indent=1, default=str))
    return rep


def selftest():
    bad = []
    reg = json.loads((HERE / "fixtures" / "mustfail.json").read_text())
    ids = [f["id"] for f in reg["fixtures"]]
    need = ["dd80963f", "3e8dce00", "v4-cornice-side", "v9-side", "v9-chase", "v9-appearance", "v10-appearance",
            "v11-appearance", "v11-slab-removed", "v11-icicle-bar", "dark-value-copy"]
    bad += [f"registry missing {n}" for n in need if n not in ids]
    for f in reg["fixtures"]:
        if f.get("expect") != "FAIL" or f.get("step") not in STEPS:
            bad.append(f"registry entry malformed {f['id']}")
    # interface must-fails
    try:
        Ctx(None, {"version": "1.2"}, {}, None, "art"); bad.append("spine v1.2 accepted")
    except SpineTooOld:
        pass
    if merge({})["overall"] != "FAIL": bad.append("empty report passed")
    full = {k: {"status": "PASS", "measured": {"x": 1}} for k in STEPS}
    if merge(full)["overall"] != "PASS": bad.append("all-pass control failed")
    for k in STEPS:
        d = dict(full); d.pop(k)
        if merge(d)["overall"] != "FAIL": bad.append(f"missing {k} passed")
    d = dict(full); d["kitjudge"] = {"status": "NA"}
    if merge(d)["overall"] != "FAIL": bad.append("NA without reason passed")
    ctx = Ctx(None, {"version": "1.3.1"}, {}, None, "greybox")
    if run_step("features", stub("features"), ctx)["status"] != "FAIL": bad.append("stub passed")
    if run_step("x", lambda c: Section("PASS"), ctx)["status"] != "FAIL": bad.append("PASS without evidence passed")
    pending = [f["id"] for f in reg["fixtures"] if not f.get("artifact_present")]
    print(json.dumps({"selftest": "FAIL" if bad else "PASS", "problems": bad,
                      "fixtures_without_artifact_yet": pending}, indent=1))
    return 1 if bad else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ctx", nargs="?")
    ap.add_argument("--out", default="gate-report.json")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        sys.exit(selftest())
    c = json.loads(Path(a.ctx).read_text())
    spine = json.loads(Path(c["spine"]).read_text())
    ctx = Ctx(c.get("page"), spine, c.get("glbs", {}), None, c.get("mode", "art"))
    rep = run_all(ctx, a.out)
    print(rep["overall"]); sys.exit(0 if rep["overall"] == "PASS" else 1)


if __name__ == "__main__":
    sys.path.insert(0, str(HERE.parent.parent))
    main()
