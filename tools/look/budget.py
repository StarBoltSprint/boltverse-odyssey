"""v62 mode B phone budget. Frame-time numbers are the tools/perf mid-range rows.

On SwiftShader those three rows are informational (tools/perf README). A feature that
still adds more than REL_FRAME of the baseline frame time, and at least REL_MS, ships
OFF so the default page does not pay for it.
"""
import re

FPS_AVG_MIN = 30
FPS_1LOW_MIN = 20
FRAME_MS_MAX = 33.333
DRAW_CALLS_MAX = 150
TEXTURE_BYTES_MAX = 268435456
REL_FRAME = 0.15
REL_MS = 2.0


def _phone_expr(text, key):
    m = re.search(rf"{key}\s*:\s*([0-9.+\-*/ ()]+)", text)
    if not m:
        raise SystemExit(f"budget drift: {key} missing from tools/perf")
    return float(eval(m.group(1), {"__builtins__": {}}, {}))


def assert_matches_perf(stats_mjs):
    text = open(stats_mjs, encoding="utf-8").read()
    want = {
        "fpsAvgMin": FPS_AVG_MIN,
        "fps1LowMin": FPS_1LOW_MIN,
        "frameMsMax": FRAME_MS_MAX,
        "drawCallsMax": DRAW_CALLS_MAX,
        "textureBytesMax": TEXTURE_BYTES_MAX,
    }
    for key, val in want.items():
        got = _phone_expr(text, key)
        if abs(got - float(val)) > 1e-3:
            raise SystemExit(f"budget drift: {key} tools/perf={got} look={val}")


def summarise(samples_ms):
    xs = [float(v) for v in samples_ms if v and v > 0]
    if not xs:
        return {"fpsAvg": None, "fps1Low": None, "frameMs": None, "samples": 0}
    xs.sort()
    mean = sum(xs) / len(xs)
    n_low = max(1, int(round(len(xs) * 0.01)))
    slow = xs[-n_low:]
    slow_mean = sum(slow) / len(slow)
    return {
        "fpsAvg": round(1000 / mean, 2),
        "fps1Low": round(1000 / slow_mean, 2),
        "frameMs": round(mean, 3),
        "samples": len(xs),
    }


def within_budget(row, swiftshader):
    reasons = []
    if row.get("drawCalls") is not None and row["drawCalls"] > DRAW_CALLS_MAX:
        reasons.append(f"draw calls {row['drawCalls']} > {DRAW_CALLS_MAX}")
    if row.get("textureBytes") is not None and row["textureBytes"] > TEXTURE_BYTES_MAX:
        reasons.append(f"textures {row['textureBytes']} > {TEXTURE_BYTES_MAX}")
    if not swiftshader:
        if row.get("fpsAvg") is not None and row["fpsAvg"] < FPS_AVG_MIN:
            reasons.append(f"fps {row['fpsAvg']} < {FPS_AVG_MIN}")
        if row.get("fps1Low") is not None and row["fps1Low"] < FPS_1LOW_MIN:
            reasons.append(f"1% low {row['fps1Low']} < {FPS_1LOW_MIN}")
        if row.get("frameMs") is not None and row["frameMs"] > FRAME_MS_MAX:
            reasons.append(f"frame {row['frameMs']} ms > {FRAME_MS_MAX}")
    return reasons


def ship_default(feature, baseline, after, swiftshader):
    """Return (enabled, reason). A feature that breaks the budget ships OFF."""
    reasons = within_budget(after, swiftshader)
    if baseline and after and baseline.get("frameMs") and after.get("frameMs"):
        extra = after["frameMs"] - baseline["frameMs"]
        if extra > REL_MS and extra > baseline["frameMs"] * REL_FRAME:
            reasons.append(f"frame +{extra:.2f} ms vs baseline ({baseline['frameMs']} ms)")
    if reasons:
        return False, "; ".join(reasons)
    return True, ""
