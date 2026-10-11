"""Grok vision through the xAI chat-completions API. Same host as tools/adventure.

The bearer token is XAI_API_KEY, or the local Grok session file. It is never written.
"""
from __future__ import annotations

import base64
import io
import json
import os
import time
import urllib.error
import urllib.request

from PIL import Image

URL = "https://api.x.ai/v1/chat/completions"
MODEL = os.environ.get("GROK_VISION_MODEL", "grok-4")
SESSION_CANDIDATES = (
    os.path.expanduser("~/.grok/auth.json"),
    "/workspace/x-live/chrome-game-home/.grok/auth.json",
)


def load_token():
    env = os.environ.get("XAI_API_KEY", "").strip()
    if env:
        return env, "env"
    for path in SESSION_CANDIDATES:
        if not os.path.isfile(path):
            continue
        data = json.load(open(path))
        if not isinstance(data, dict) or not data:
            continue
        acc = next(iter(data.values()))
        key = acc.get("key") or acc.get("access_token")
        if key:
            return key, os.path.basename(path)
    raise RuntimeError("no XAI_API_KEY and no Grok session token")


def data_url(path, max_w=768):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    if w > max_w:
        im = im.resize((max_w, max(1, int(round(h * max_w / w)))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=72)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return "data:image/jpeg;base64," + b64, [w, h]


def extract_json(text):
    raw = text.strip()
    if "```" in raw:
        parts = raw.split("```")
        for part in parts:
            body = part.strip()
            if body.startswith("json"):
                body = body[4:].strip()
            if body.startswith("{"):
                raw = body
                break
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end < start:
        raise ValueError("no JSON object in vision reply")
    return json.loads(raw[start : end + 1])


def complete(content, max_tokens=900):
    token, source = load_token()
    body = json.dumps({
        "model": MODEL,
        "temperature": 0,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": "You reply with one JSON object and no markdown."},
            {"role": "user", "content": content},
        ],
    }).encode()
    req = urllib.request.Request(
        URL,
        data=body,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
        method="POST",
    )
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            data = json.loads(res.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read()[:400].decode("utf-8", "replace")
        raise RuntimeError(f"grok vision HTTP {exc.code}: {detail}") from exc
    dt = time.perf_counter() - t0
    text = data["choices"][0]["message"]["content"]
    usage = data.get("usage") or {}
    ticks = int(usage.get("cost_in_usd_ticks") or 0)
    log = {
        "model": data.get("model"),
        "seconds": round(dt, 3),
        "token_source": source,
        "prompt_tokens": usage.get("prompt_tokens"),
        "completion_tokens": usage.get("completion_tokens"),
        "reasoning_tokens": (usage.get("completion_tokens_details") or {}).get("reasoning_tokens"),
        "image_tokens": (usage.get("prompt_tokens_details") or {}).get("image_tokens"),
        "cost_in_usd_ticks": ticks,
        "cost_usd": ticks / 1e10,
    }
    return text, log


def _norm_box(box):
    if not isinstance(box, (list, tuple)) or len(box) != 4:
        raise ValueError("box")
    vals = [float(v) for v in box]
    if max(vals) > 1.5:
        vals = [v / 100.0 if max(vals) > 1.5 else v for v in vals]
        if max(vals) > 1.5:
            vals = [v / max(vals) for v in vals]
    x0, y0, x1, y1 = vals
    if x1 < x0:
        x0, x1 = x1, x0
    if y1 < y0:
        y0, y1 = y1, y0
    return [max(0.0, min(1.0, x0)), max(0.0, min(1.0, y0)), max(0.0, min(1.0, x1)), max(0.0, min(1.0, y1))]


def perceive(image_path):
    url, _wh = data_url(image_path)
    prompt = (
        "This is one sci-fi desert city plate. The hero is the broad dark slab tower "
        "just left of the road centre: slanted cap, vertical seams, broken mid ledges, "
        "base in the dune. It is not the thinner tower against the left cliff, and not "
        "the ringed spire right of centre. "
        "Estimate the camera and that one tower. Boxes are normalized 0..1, origin top-left, "
        "full frame. JSON keys: fov_y_deg (vertical field), pitch_deg (positive looks up), "
        "horizon_frac (row of the horizon / height), hero {box, height_m, width_m, depth_m, "
        "dune_crest_m}, features (4 to 8 items, each {id, box}). "
        "Feature ids from: cap, seam, ledge, damage, base, gold-edge. "
        "height_m is the slab above the dune, not the whole cliff."
    )
    text, log = complete([
        {"type": "image_url", "image_url": {"url": url}},
        {"type": "text", "text": prompt},
    ])
    data = extract_json(text)
    hero = data.get("hero") or {}
    hero["box"] = _norm_box(hero.get("box"))
    feats = []
    for feat in data.get("features") or []:
        try:
            feats.append({"id": str(feat.get("id", "part")), "box": _norm_box(feat.get("box"))})
        except (TypeError, ValueError):
            continue
    out = {
        "fov_y_deg": float(data.get("fov_y_deg")),
        "pitch_deg": float(data.get("pitch_deg", 0)),
        "horizon_frac": float(data.get("horizon_frac")),
        "hero": {
            "box": hero["box"],
            "height_m": float(hero.get("height_m")),
            "width_m": float(hero.get("width_m")),
            "depth_m": float(hero.get("depth_m")),
            "dune_crest_m": float(hero.get("dune_crest_m")),
        },
        "features": feats,
        "raw": text,
        "usage": log,
    }
    return out


def pick_hero(sheet_path, proposals):
    """Vision chooses one numbered classic proposal. It does not draw a new box."""
    url, _wh = data_url(sheet_path, max_w=1024)
    listing = []
    for p in proposals:
        listing.append(
            f"id {p['id']}: centroid x {p['cx']:.3f}, box {[round(v, 3) for v in p['box']]}, area {p['area']}"
        )
    prompt = (
        "Numbered boxes are candidate towers on one desert city plate. "
        "Pick the broad dark slab just left of the road centre: slanted cap, vertical seams, "
        "broken mid ledges, base in the dune. "
        "Do not pick the thinner tower against the left cliff. Do not pick the ringed spire right of centre. "
        "Candidates:\n" + "\n".join(listing) + "\n"
        "JSON keys: hero_id (one of the ids), note (short)."
    )
    text, log = complete([
        {"type": "image_url", "image_url": {"url": url}},
        {"type": "text", "text": prompt},
    ], max_tokens=400)
    data = extract_json(text)
    hero_id = int(data.get("hero_id"))
    known = {int(p["id"]) for p in proposals}
    if hero_id not in known:
        raise ValueError(f"hero_id {hero_id} not in {sorted(known)}")
    return {"hero_id": hero_id, "note": str(data.get("note", ""))[:240], "raw": text, "usage": log}


def scene_graph(key_path, clay_path, measures):
    """One vision pass over the key and the clay, constrained by classic measurements."""
    url_k, _ = data_url(key_path)
    url_c, _ = data_url(clay_path)
    prompt = (
        "First image is the city plate. Second is the clay form of the same camera. "
        "The hero is the broad dark slab just left of the road centre. "
        "Classic measurements already taken on its mask (do not invent a different tower): "
        + json.dumps(measures)
        + ". JSON keys: taper_deg, bite_frac (0..1 down the slab), bite_side (left|right|none), "
        "depth_m, height_m, note. Keep height_m inside 20..400 and depth_m inside 4..120."
    )
    text, log = complete([
        {"type": "image_url", "image_url": {"url": url_k}},
        {"type": "image_url", "image_url": {"url": url_c}},
        {"type": "text", "text": prompt},
    ], max_tokens=500)
    data = extract_json(text)
    return {
        "taper_deg": float(data.get("taper_deg", measures.get("taper_deg", 0))),
        "bite_frac": float(data.get("bite_frac", measures.get("bite_frac", 0))),
        "bite_side": str(data.get("bite_side", measures.get("bite_side", "none"))),
        "depth_m": float(data.get("depth_m", measures.get("depth_m", 20))),
        "height_m": float(data.get("height_m", measures.get("height_m", 150))),
        "note": str(data.get("note", ""))[:240],
        "raw": text,
        "usage": log,
    }


def judge_mask(overlay_path):
    url, _wh = data_url(overlay_path)
    prompt = (
        "The red overlay is a proposed mask for the broad dark slab tower just left of "
        "the road centre (not the cliff tower, not the ringed spire). "
        "JSON keys: only_hero (bool), leak (none|sky|sand|neighbor), miss (none|edge|top|base), "
        "action (keep|erode|dilate), note (short)."
    )
    text, log = complete([
        {"type": "image_url", "image_url": {"url": url}},
        {"type": "text", "text": prompt},
    ], max_tokens=400)
    data = extract_json(text)
    action = str(data.get("action", "keep")).lower()
    if action not in ("keep", "erode", "dilate"):
        action = "keep"
    return {
        "only_hero": bool(data.get("only_hero")),
        "leak": str(data.get("leak", "none")),
        "miss": str(data.get("miss", "none")),
        "action": action,
        "note": str(data.get("note", ""))[:240],
        "usage": log,
    }


def judge_render(render_path, key_path):
    url_r, _ = data_url(render_path)
    url_k, _ = data_url(key_path)
    prompt = (
        "First image: a shaded render of a reconstructed slab tower, yawed so the side shows. "
        "Second image: the original plate. Judge only the broad dark slab left of the road centre. "
        "JSON keys: score (0 to 1), silhouette (ok|wide|narrow|tall|short), "
        "relief (ok|flat|bumpy), depth (ok|deep|shallow), action "
        "(keep|less_relief|more_relief|narrower|wider|deeper|shallower), note (short)."
    )
    text, log = complete([
        {"type": "image_url", "image_url": {"url": url_r}},
        {"type": "image_url", "image_url": {"url": url_k}},
        {"type": "text", "text": prompt},
    ], max_tokens=500)
    data = extract_json(text)
    action = str(data.get("action", "keep")).lower()
    allowed = {"keep", "less_relief", "more_relief", "narrower", "wider", "deeper", "shallower"}
    if action not in allowed:
        action = "keep"
    return {
        "score": float(data.get("score", 0)),
        "silhouette": str(data.get("silhouette", "")),
        "relief": str(data.get("relief", "")),
        "depth": str(data.get("depth", "")),
        "action": action,
        "note": str(data.get("note", ""))[:240],
        "usage": log,
    }
