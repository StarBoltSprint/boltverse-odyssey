"""Before / after table of two key-compare runs (object-gate key-compare.json files).

    python3 kc_diff.py BEFORE/key-compare.json AFTER/key-compare.json [--labels before,after] [> diff.md]

Per element: verdict and each metric before -> after with the direction (better / worse / same, by the metric's sense:
IoU and structure higher = better, Delta E lower = better; changes under 0.01 IoU/SSIM or 0.5 Delta E are 'same')."""
import json, sys

EPS = {"iou": 0.01, "deLit": 0.5, "deShadow": 0.5, "structure": 0.01}
LOWER = {"deLit", "deShadow"}


def cell(m, a, b):
    f = (lambda v: "-" if v is None else (f"{v:.2f}" if m in ("iou", "structure") else f"{v:.1f}"))
    if a is None and b is None: return "-"
    if a is None or b is None: return f"{f(a)} → {f(b)}"
    d = b - a; s = "=" if abs(d) < EPS[m] else (("▲" if (d < 0) == (m in LOWER) else "▼"))
    return f"{f(a)} → {f(b)} {s}"


def main(a, b, labels=("before", "after")):
    A = {e["id"]: e for e in json.load(open(a))["elements"]}; B = {e["id"]: e for e in json.load(open(b))["elements"]}
    L = [f"| Element | Verdict {labels[0]} → {labels[1]} | IoU | ΔE lit | ΔE shadow | Structure (SSIM) |", "|---|---|---|---|---|---|"]
    better = worse = 0
    for i in list(A) + [k for k in B if k not in A]:
        x, y = A.get(i, {}), B.get(i, {})
        row = [cell(m, x.get(m), y.get(m)) for m in ("iou", "deLit", "deShadow", "structure")]
        better += sum("▲" in c for c in row); worse += sum("▼" in c for c in row)
        L.append(f"| {y.get('name', x.get('name', i))} | {x.get('verdict', '-')} → {y.get('verdict', '-')} | " + " | ".join(row) + " |")
    L += ["", f"▲ better: {better} · ▼ worse: {worse} (metric changes beyond noise: IoU/SSIM 0.01, ΔE 0.5)"]
    return "\n".join(L) + "\n"


if __name__ == "__main__":
    lab = ("before", "after")
    if "--labels" in sys.argv: lab = tuple(sys.argv[sys.argv.index("--labels") + 1].split(","))
    print(main(sys.argv[1], sys.argv[2], lab), end="")
