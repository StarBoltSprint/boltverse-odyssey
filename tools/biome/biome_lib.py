"""biome_lib.py - shared helpers for the biome bible pipeline (tools/biome).

One biome = one bible JSON. Tracked part: tools/biome/biomes/<id>.json (numbers, slots, budgets; no palette, no prompt
words - repo rule 2026-10-03). Untracked part: tools/biome/biomes/<id>.local.json (palette hex, style block, avoid list,
tone words). load_biome() deep-merges local over tracked. Everything else in the chain reads the merged dict.

No network, no Grok, no Imagine. Pure python3 + numpy (+ Pillow for images).
"""
import hashlib, json, os, copy, re

HERE = os.path.dirname(os.path.abspath(__file__))
BIOMES = os.path.join(HERE, "biomes")
SCHEMA = os.path.join(HERE, "schema", "biome.schema.json")
STYLE = os.path.join(HERE, "style")
TEMPLATES = os.path.join(HERE, "templates")
LOCAL_MARK = "$local"


# ---------------------------------------------------------------- json io
def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json(path, obj):
    os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)
        f.write("\n")


def deep_merge(base, over):
    out = copy.deepcopy(base)
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def biome_paths(biome_id_or_path):
    p = biome_id_or_path
    if os.path.exists(p) and p.endswith(".json"):
        tracked = p[:-len(".local.json")] + ".json" if p.endswith(".local.json") else p
    else:
        tracked = os.path.join(BIOMES, f"{p}.json")
    local = tracked[:-5] + ".local.json"
    return tracked, local


def find_local_marks(obj, prefix=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from find_local_marks(v, f"{prefix}.{k}" if prefix else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from find_local_marks(v, f"{prefix}[{i}]")
    elif obj == LOCAL_MARK:
        yield prefix


# keys that carry palette or prompt words -> only in *.local.json
LOCAL_KEYS = {
    ("palette",), ("styleBlock",), ("avoid",), ("tone",), ("sun", "hex"), ("fog", "color"),
    ("fog", "bands", "*", "color"), ("objects", "*", "subject"), ("ground", "materials", "*", "subject"),
    ("sky", "subject"), ("planet", "subject"), ("anchor", "subject"), ("lore",),
}


def _match(path, pat):
    if len(path) != len(pat):
        return False
    return all(p == "*" or p == q for p, q in zip(pat, path))


def split_biome(b):
    """Split a full biome dict into (tracked, local). Tracked gets '$local' marks where words/colours were."""
    tracked, local = {}, {}

    def walk(src, tdst, ldst, path):
        if isinstance(src, dict):
            for k, v in src.items():
                p = path + (k,)
                if any(_match(p, pat) for pat in LOCAL_KEYS):
                    tdst[k] = LOCAL_MARK
                    ldst[k] = copy.deepcopy(v)
                    continue
                if isinstance(v, (dict, list)):
                    tdst[k] = {} if isinstance(v, dict) else []
                    ldst_child = {} if isinstance(v, dict) else []
                    walk(v, tdst[k], ldst_child, p)
                    if ldst_child and any(x not in ({}, None) for x in (ldst_child.values() if isinstance(ldst_child, dict) else ldst_child)):
                        ldst[k] = ldst_child
                else:
                    tdst[k] = v
        elif isinstance(src, list):
            for i, v in enumerate(src):
                p = path + ("*",)
                if isinstance(v, (dict, list)):
                    t = {} if isinstance(v, dict) else []
                    l = {} if isinstance(v, dict) else []
                    walk(v, t, l, p)
                    tdst.append(t)
                    ldst.append(l if l else None)
                else:
                    if any(_match(p, pat) for pat in LOCAL_KEYS):
                        tdst.append(LOCAL_MARK); ldst.append(v)
                    else:
                        tdst.append(v); ldst.append(None)

    walk(b, tracked, local, ())
    return tracked, _clean_lists(local)


def _clean_lists(o):
    # lists in the local part keep positions (None = take the tracked value); merge_local_lists() merges item by item.
    return o


def merge_local_lists(tracked, local):
    """deep merge where lists of dicts merge item by item (used for objects[], fog.bands[], ground.materials[])."""
    if isinstance(tracked, dict) and isinstance(local, dict):
        out = copy.deepcopy(tracked)
        for k, v in local.items():
            out[k] = merge_local_lists(tracked.get(k), v) if k in tracked else copy.deepcopy(v)
        return out
    if isinstance(tracked, list) and isinstance(local, list):
        out = []
        for i in range(max(len(tracked), len(local))):
            t = tracked[i] if i < len(tracked) else None
            l = local[i] if i < len(local) else None
            out.append(copy.deepcopy(t) if l is None else (merge_local_lists(t, l) if t is not None else copy.deepcopy(l)))
        return out
    return copy.deepcopy(local) if local is not None else copy.deepcopy(tracked)


def load_biome_merged(biome_id_or_path, require_local=False):
    tracked, local = biome_paths(biome_id_or_path)
    t = read_json(tracked) if os.path.exists(tracked) else {}
    if os.path.exists(local):
        b = merge_local_lists(t, read_json(local))
    else:
        if require_local:
            raise SystemExit(f"[biome] missing untracked local file {local}")
        b = t
    missing = sorted(set(find_local_marks(b)))
    return b, {"tracked": tracked, "local": local if os.path.exists(local) else None, "missing_local": missing}


load_biome = load_biome_merged


# ---------------------------------------------------------------- schema (tiny draft-07 subset, no deps)
def validate(obj, schema=None, path="$"):
    """Return a list of error strings. Supports type, required, properties, additionalProperties(bool), enum,
    minimum, maximum, minItems, maxItems, items, pattern, oneOf(types), const."""
    if schema is None:
        schema = read_json(SCHEMA)
    errs = []
    root = schema

    def resolve(s):
        while isinstance(s, dict) and "$ref" in s:
            ref = s["$ref"]
            assert ref.startswith("#/"), ref
            node = root
            for part in ref[2:].split("/"):
                node = node[part]
            s = node
        return s

    def tname(v):
        if isinstance(v, bool): return "boolean"
        if isinstance(v, int): return "integer"
        if isinstance(v, float): return "number"
        if isinstance(v, str): return "string"
        if isinstance(v, list): return "array"
        if isinstance(v, dict): return "object"
        return "null"

    def check(v, s, p):
        s = resolve(s)
        if v == LOCAL_MARK:
            return  # placeholder for an untracked value
        if "anyOf" in s:
            if all(_collect(v, alt, p) for alt in s["anyOf"]):
                errs.append(f"{p}: matches none of anyOf")
            return
        t = s.get("type")
        if t:
            ts = t if isinstance(t, list) else [t]
            got = tname(v)
            ok = got in ts or (got == "integer" and "number" in ts)
            if not ok:
                errs.append(f"{p}: type {got}, want {t}"); return
        if "const" in s and v != s["const"]:
            errs.append(f"{p}: must be {s['const']!r}")
        if "enum" in s and v not in s["enum"]:
            errs.append(f"{p}: {v!r} not in {s['enum']}")
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            if "minimum" in s and v < s["minimum"]: errs.append(f"{p}: {v} < {s['minimum']}")
            if "maximum" in s and v > s["maximum"]: errs.append(f"{p}: {v} > {s['maximum']}")
        if isinstance(v, str) and "pattern" in s and not re.search(s["pattern"], v):
            errs.append(f"{p}: {v!r} !~ /{s['pattern']}/")
        if isinstance(v, list):
            if "minItems" in s and len(v) < s["minItems"]: errs.append(f"{p}: {len(v)} items < {s['minItems']}")
            if "maxItems" in s and len(v) > s["maxItems"]: errs.append(f"{p}: {len(v)} items > {s['maxItems']}")
            if "items" in s:
                for i, x in enumerate(v):
                    check(x, s["items"], f"{p}[{i}]")
        if isinstance(v, dict):
            for r in s.get("required", []):
                if r not in v: errs.append(f"{p}: missing {r}")
            props = s.get("properties", {})
            for k, x in v.items():
                if k in props:
                    check(x, props[k], f"{p}.{k}")
                elif s.get("additionalProperties") is False:
                    errs.append(f"{p}: unexpected key {k}")

    def _collect(v, s, p):
        before = len(errs)
        check(v, s, p)
        new = errs[before:]
        del errs[before:]
        return new

    check(obj, schema, path)
    return errs


# ---------------------------------------------------------------- colour
def hex_to_rgb01(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def rgb01_to_hex(rgb):
    return "#" + "".join(f"{max(0, min(255, int(round(c * 255)))):02x}" for c in rgb)


def srgb_to_linear(c):
    import numpy as np
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    import numpy as np
    c = np.clip(np.asarray(c, dtype=np.float64), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def rgb_to_lab(rgb):
    """sRGB 0..1 (..., 3) -> CIE Lab D65 (..., 3)."""
    import numpy as np
    lin = srgb_to_linear(rgb)
    M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    xyz = lin @ M.T / np.array([0.95047, 1.0, 1.08883])
    e = 216 / 24389; k = 24389 / 27
    f = np.where(xyz > e, np.cbrt(xyz), (k * xyz + 16) / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], -1)


def lab_to_rgb(lab):
    import numpy as np
    lab = np.asarray(lab, dtype=np.float64)
    fy = (lab[..., 0] + 16) / 116; fx = fy + lab[..., 1] / 500; fz = fy - lab[..., 2] / 200
    e = 216 / 24389; k = 24389 / 27
    def finv(f):
        return np.where(f ** 3 > e, f ** 3, (116 * f - 16) / k)
    xyz = np.stack([finv(fx), finv(fy), finv(fz)], -1) * np.array([0.95047, 1.0, 1.08883])
    Mi = np.array([[3.2404542, -1.5371385, -0.4985314], [-0.9692660, 1.8760108, 0.0415560], [0.0556434, -0.2040259, 1.0572252]])
    return linear_to_srgb(xyz @ Mi.T)


def delta_e2000(lab1, lab2):
    """CIEDE2000, broadcasting (..., 3)."""
    import numpy as np
    L1, a1, b1 = np.moveaxis(np.asarray(lab1, dtype=np.float64), -1, 0)
    L2, a2, b2 = np.moveaxis(np.asarray(lab2, dtype=np.float64), -1, 0)
    C1 = np.hypot(a1, b1); C2 = np.hypot(a2, b2); Cb = (C1 + C2) / 2
    G = 0.5 * (1 - np.sqrt(Cb ** 7 / (Cb ** 7 + 25.0 ** 7)))
    a1p = (1 + G) * a1; a2p = (1 + G) * a2
    C1p = np.hypot(a1p, b1); C2p = np.hypot(a2p, b2)
    h1p = np.degrees(np.arctan2(b1, a1p)) % 360; h2p = np.degrees(np.arctan2(b2, a2p)) % 360
    dLp = L2 - L1; dCp = C2p - C1p
    dh = h2p - h1p
    dh = np.where(C1p * C2p == 0, 0, np.where(dh > 180, dh - 360, np.where(dh < -180, dh + 360, dh)))
    dHp = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dh / 2))
    Lbp = (L1 + L2) / 2; Cbp = (C1p + C2p) / 2
    hs = h1p + h2p
    hbp = np.where(C1p * C2p == 0, hs, np.where(np.abs(h1p - h2p) <= 180, hs / 2, np.where(hs < 360, (hs + 360) / 2, (hs - 360) / 2)))
    T = (1 - 0.17 * np.cos(np.radians(hbp - 30)) + 0.24 * np.cos(np.radians(2 * hbp)) + 0.32 * np.cos(np.radians(3 * hbp + 6))
         - 0.20 * np.cos(np.radians(4 * hbp - 63)))
    dth = 30 * np.exp(-(((hbp - 275) / 25) ** 2))
    Rc = 2 * np.sqrt(Cbp ** 7 / (Cbp ** 7 + 25.0 ** 7))
    Sl = 1 + 0.015 * (Lbp - 50) ** 2 / np.sqrt(20 + (Lbp - 50) ** 2)
    Sc = 1 + 0.045 * Cbp; Sh = 1 + 0.015 * Cbp * T
    Rt = -np.sin(np.radians(2 * dth)) * Rc
    return np.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh))


def delta_e76(lab1, lab2):
    import numpy as np
    return np.linalg.norm(np.asarray(lab1, float) - np.asarray(lab2, float), axis=-1)


def kelvin_to_rgb01(k):
    """Tanner Helland approximation, good to ~1-2% for 1000-12000K. Used only to derive prompt words / fallbacks."""
    import math
    t = k / 100.0
    r = 255 if t <= 66 else 329.698727446 * ((t - 60) ** -0.1332047592)
    g = 99.4708025861 * math.log(t) - 161.1195681661 if t <= 66 else 288.1221695283 * ((t - 60) ** -0.0755148492)
    b = 255 if t >= 66 else (0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307)
    return tuple(max(0, min(255, c)) / 255.0 for c in (r, g, b))


# ---------------------------------------------------------------- cache key
def cache_key(bible_version, style_block, slot_prompt):
    """sha256(bibleVersion + styleBlock + slotPrompt) - Grok answer 8. Any bible bump regenerates every slot."""
    h = hashlib.sha256()
    h.update(str(bible_version).encode()); h.update(b"\x1f")
    h.update((style_block or "").encode()); h.update(b"\x1f")
    h.update(slot_prompt.encode())
    return h.hexdigest()


def style_block(b):
    """Style block text. From the merged biome, else from style/<styleId>.local.txt, else a visible placeholder."""
    s = b.get("styleBlock")
    if isinstance(s, str) and s and s != LOCAL_MARK:
        return s
    sid = b.get("styleId", "aaa-2026")
    p = os.path.join(STYLE, f"{sid}.local.txt")
    if os.path.exists(p):
        return open(p, encoding="utf-8").read().strip()
    return f"<STYLE BLOCK {sid} from the local file>"


def avoid_list(b):
    a = b.get("avoid")
    if isinstance(a, list) and a:
        return a
    sid = b.get("styleId", "aaa-2026")
    p = os.path.join(STYLE, f"{sid}.avoid.local.txt")
    if os.path.exists(p):
        return [l.strip() for l in open(p, encoding="utf-8") if l.strip() and not l.startswith("#")]
    return ["<AVOID LIST from the local file>"]
