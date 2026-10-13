#!/usr/bin/env python3
"""Boltverse progress meter. A step counts only if its tools exist AND every selftest runs and exits 0.

  python3 tools/progress-meter/meter.py [--repo .] [--steps steps.json] [--timing W/timing.json ...]
        [--journal extra.md ...] [--out DIR] [--timeout 300]
Writes DIR/progress.json and DIR/REPORT.md. Resemblance numbers are read from outputs that existing tools
already wrote (no new score is computed here); a zone with no such output is MISSING.
"""
import argparse, json, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))


def run_test(repo, cmd, timeout):
    t0 = time.time()
    if not os.path.exists(os.path.join(repo, cmd[-1])):
        return {"cmd": " ".join(cmd), "status": "MISSING", "seconds": 0, "tail": "test file not found"}
    try:
        p = subprocess.run(cmd, cwd=repo, capture_output=True, text=True, timeout=timeout)
        st, tail = ("PASS" if p.returncode == 0 else "FAIL"), (p.stdout + p.stderr)[-600:]
        rc = p.returncode
    except subprocess.TimeoutExpired:
        st, tail, rc = "FAIL", f"timeout {timeout}s", None
    return {"cmd": " ".join(cmd), "status": st, "rc": rc, "seconds": round(time.time() - t0, 1), "tail": tail}


def judge_step(repo, step, timeout):
    missing = [t for t in step.get("tools", []) if not os.path.exists(os.path.join(repo, t))]
    out = {"id": step["id"], "name": step["name"], "missingTools": missing, "tests": []}
    if missing:
        out["status"], out["why"] = "MISSING", "tool not found: " + ", ".join(missing)
        return out
    if not step.get("tests"):
        out["status"], out["why"] = "MISSING", "tool exists but has no selftest"
        return out
    with ThreadPoolExecutor(4) as ex:
        out["tests"] = list(ex.map(lambda c: run_test(repo, c, timeout), step["tests"]))
    bad = [t for t in out["tests"] if t["status"] != "PASS"]
    if bad:
        out["status"] = "FAIL" if any(t["status"] == "FAIL" for t in bad) else "MISSING"
        out["why"] = "; ".join(f'{t["cmd"]}: {t["status"]}' for t in bad)
    else:
        out["status"], out["why"] = "PASS", "all selftests pass"
    rf = step.get("requireFields")
    if rf and out["status"] == "PASS":
        p = os.path.join(repo, rf["file"])
        txt = open(p).read() if os.path.exists(p) else ""
        if not txt:
            try:
                txt = subprocess.run(["git", "show", "HEAD:" + rf["file"]], cwd=repo, capture_output=True, text=True).stdout
            except Exception:
                txt = ""
        lack = [f for f in rf["fields"] if f'"{f}"' not in txt]
        if lack:
            out["status"], out["why"] = "FAIL", f'selftests pass but {rf["file"]} lacks fields: ' + ", ".join(lack)
    return out


def read_json(repo, rel):
    p = os.path.join(repo, rel)
    if os.path.exists(p):
        return json.load(open(p))
    r = subprocess.run(["git", "show", "HEAD:" + rel], cwd=repo, capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 else None


def resemblance(repo, items):
    rows = []
    for it in items:
        row = dict(it)
        if not it.get("file"):
            row.update(status="MISSING", value=None, percent=None, why="no resemblance output from an existing tool")
            rows.append(row); continue
        d = read_json(repo, it["file"])
        v = d
        for k in it["path"]:
            v = v.get(k) if isinstance(v, dict) else None
        if not isinstance(v, (int, float)):
            row.update(status="MISSING", value=None, percent=None, why="file or field absent")
        else:
            row.update(value=v, percent=round(100 * v, 1),
                       status=("n/a" if it.get("need") is None else ("PASS" if v >= it["need"] else "FAIL")))
        rows.append(row)
    return rows


AUTO = re.compile(r"`[^`]*(python3|node|bash)\s[^`]*(tools/|scripts/|packs/|biome/)[^`]*`")
NOT_AUTO = re.compile(r"^\s*(none|no |the spec|leave)", re.I)


def manual_fixes(path):
    """failures.md: an entry is automated when its Guard cites a runnable command under tools/scripts/packs/biome
    and does not open with 'None' / 'No ...'. Markdown tables (corrections logs): a row is automated when its
    'How / where' or 'Verified by' cell names a tools/ path."""
    if not os.path.exists(path):
        return {"file": path, "status": "MISSING"}
    txt = open(path).read()
    ents = re.split(r"\n### ", txt)[1:]
    if ents:
        manual = []
        for e in ents:
            m = re.search(r"^\| Guard \|(.*)\|\s*$", e, re.M)
            g = (m.group(1) if m else "").strip()
            if not g or NOT_AUTO.match(g) or not AUTO.search(g):
                manual.append(e.splitlines()[0][:110])
        return {"file": path, "entries": len(ents), "manual": len(manual), "manualTitles": manual}
    rows = [l for l in txt.splitlines() if re.match(r"^\|\s*\d+\s*\|", l)]
    manual = [r[:110] for r in rows if "tools/" not in r]
    return {"file": path, "entries": len(rows), "manual": len(manual), "manualTitles": manual}


def timing(files, budget):
    out = []
    for f in files:
        if not os.path.exists(f):
            out.append({"file": f, "status": "MISSING"}); continue
        d = json.load(open(f)); S = d.get("stages", [])
        tot = round(sum(s.get("seconds", 0) for s in S), 1)
        img = round(sum(s.get("seconds", 0) for s in S if s.get("imagine")), 2)
        failed = [s["stage"] for s in S if s.get("status") != "ok"]
        complete = bool(S) and not failed and S[-1]["stage"] in ("artdirector", "play")
        real = img > 5  # mocked / seeded Imagine runs take well under a second
        out.append({"file": f, "totalSeconds": tot, "imagineSeconds": img, "budgetSeconds": budget,
                    "withinBudget": tot <= budget, "completeRun": complete, "failedStages": failed,
                    "realImagine": real, "countsAsEndToEnd": complete and real})
    return out


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default=os.path.abspath(os.path.join(HERE, "..", "..")))
    ap.add_argument("--steps", default=os.path.join(HERE, "steps.json"))
    ap.add_argument("--timing", nargs="*", default=[])
    ap.add_argument("--journal", nargs="*", default=[])
    ap.add_argument("--out", default="progress-out")
    ap.add_argument("--timeout", type=int, default=300)
    a = ap.parse_args(argv)
    cfg = json.load(open(a.steps))
    steps = [judge_step(a.repo, s, a.timeout) for s in cfg["steps"]]
    done = sum(s["status"] == "PASS" for s in steps)
    res = resemblance(a.repo, cfg.get("resemblance", []))
    measured = [r["percent"] for r in res if r.get("percent") is not None]
    jr = [manual_fixes(os.path.join(a.repo, j)) for j in cfg.get("manualFixJournals", [])] + [manual_fixes(j) for j in a.journal]
    tot_e = sum(j.get("entries", 0) for j in jr); tot_m = sum(j.get("manual", 0) for j in jr)
    tm = timing(a.timing, cfg.get("budgetSeconds", 480))
    e2e = [t for t in tm if t.get("countsAsEndToEnd")]
    rep = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "repoHead": subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=a.repo, capture_output=True, text=True).stdout.strip(),
        "stepCompletionPercent": round(100 * done / len(steps), 1), "stepsDone": done, "stepsTotal": len(steps),
        "steps": steps,
        "resemblance": {"rows": res, "zonesMissing": sorted({r["zone"] for r in res if r["status"] == "MISSING"}),
                        "meanRecordedPercent": round(sum(measured) / len(measured), 1) if measured else None},
        "manualFixes": {"journals": jr, "entries": tot_e, "notYetAutomated": tot_m,
                        "manualSharePercent": round(100 * tot_m / tot_e, 1) if tot_e else None},
        "endToEnd": {"budgetSeconds": cfg.get("budgetSeconds", 480), "runs": tm,
                     "measured": bool(e2e), "bestSeconds": min((t["totalSeconds"] for t in e2e), default=None)},
    }
    os.makedirs(a.out, exist_ok=True)
    json.dump(rep, open(os.path.join(a.out, "progress.json"), "w"), indent=1)
    open(os.path.join(a.out, "REPORT.md"), "w").write(md(rep))
    print(f'steps {rep["stepCompletionPercent"]}% ({done}/{len(steps)}) | manual {rep["manualFixes"]["manualSharePercent"]}% | e2e measured {rep["endToEnd"]["measured"]}')
    return rep


def md(r):
    L = [f"# Boltverse progress — {r['generatedAt']} (HEAD {r['repoHead']})", "",
         f"**Steps done: {r['stepCompletionPercent']} %** ({r['stepsDone']}/{r['stepsTotal']}). A step counts only if its tool exists and every selftest passes.", "",
         "| Step | Status | Why |", "|---|---|---|"]
    L += [f"| {s['name']} | {s['status']} | {s['why'][:160]} |" for s in r["steps"]]
    L += ["", "## Resemblance to the key image (recorded by existing tools)", "", "| Zone | Item | Metric | Value | % | Status |", "|---|---|---|---|---|---|"]
    for x in r["resemblance"]["rows"]:
        L.append(f"| {x['zone']} | {x['item']} | {x.get('metric','')} | {x.get('value')} | {x.get('percent')} | {x['status']} |")
    m = r["manualFixes"]
    L += ["", f"## Manual fixes not yet turned into tool fixes: {m['notYetAutomated']}/{m['entries']} ({m['manualSharePercent']} %)", ""]
    for j in m["journals"]:
        L.append(f"- `{j['file']}`: {j.get('manual')}/{j.get('entries')} manual")
    e = r["endToEnd"]
    L += ["", f"## End-to-end time vs {e['budgetSeconds']//60} min", "",
          f"Real end-to-end measured: **{'yes, best ' + str(e['bestSeconds']) + ' s' if e['measured'] else 'no'}**", ""]
    for t in e["runs"]:
        if t.get("status") == "MISSING":
            L.append(f"- `{t['file']}`: MISSING"); continue
        L.append(f"- `{t['file']}`: {t['totalSeconds']} s, Imagine {t['imagineSeconds']} s, complete={t['completeRun']}, failed={t['failedStages']}, real Imagine={t['realImagine']}")
    return "\n".join(L) + "\n"


if __name__ == "__main__":
    main()
