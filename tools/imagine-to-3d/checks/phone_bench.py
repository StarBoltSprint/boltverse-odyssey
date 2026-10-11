"""Score a real-phone bench result (tools/perf/phone-bench/bench.html) against a frame-time target.
The box has no GPU, so phone fps is never estimated here: without a bench result the row is NEEDS_PHONE.
Input: a result link (bench.html#r=<base64url JSON>), the raw payload, or a JSON file (decoded result).
Base = v4: the first, coolest base (base0); v2/v3: mean of the rows named 'base ...' (pipelined ms per frame); v1: sync 'gpu'.
python3 checks/phone_bench.py '<link>' --target 22   -> JSON row, exit 1 on FAIL
Rule (docs/METHOD/phone-perf.md): a FAIL is fixed only by removing work that never reaches the screen, never by lowering the look."""
import argparse, base64, json, os, re, sys


def decode(src):
    if isinstance(src, dict): return src
    if os.path.exists(src):
        return json.load(open(src))
    m = re.search(r"#r=([\w-]+)", src); p = m.group(1) if m else src.strip()
    return json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)).decode("utf8"))


def score(src, target=22.0):
    if not src:
        return dict(check="phone bench base ms (ratio 2)", value=None, limit=target, status="NEEDS_PHONE",
                    info="no perf.phoneBench in the spec: ask the owner to open tools/perf/phone-bench/bench.html on the phone and paste the result link")
    r = decode(src); key = "ms" if r.get("v", 1) >= 2 else "gpu"
    if r.get("v", 1) >= 4:   # v4 (thermally fair): the first, coolest base measurement
        b = r["base0"]
        return dict(check="phone bench base ms (ratio 2)", value=b, limit=target, status="PASS" if b <= target else "FAIL",
                    info=f"bench v4 cool base, {r['info'].get('gpu')} DPR {r['info'].get('dpr')}, {len(r['rows'])} rows, {r.get('t')}")
    base = [x[key] for x in r["rows"] if re.match(r"^base", x["n"])]
    if not base:
        return dict(check="phone bench base ms (ratio 2)", value=None, limit=target, status="FAIL", info="result has no base row")
    b = round(sum(base) / len(base), 1)
    return dict(check="phone bench base ms (ratio 2)", value=b, limit=target, status="PASS" if b <= target else "FAIL",
                info=f"bench v{r.get('v', 1)} metric {key}, {r['info'].get('gpu')} DPR {r['info'].get('dpr')}, {len(r['rows'])} rows, {r.get('t')}")


if __name__ == "__main__":
    a = argparse.ArgumentParser(); a.add_argument("src"); a.add_argument("--target", type=float, default=22.0)
    o = a.parse_args(); row = score(o.src, o.target); print(json.dumps(row)); sys.exit(1 if row["status"] == "FAIL" else 0)
