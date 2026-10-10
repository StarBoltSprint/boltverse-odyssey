"""Assemble the staging runtime module: zb-preview-1008/mesas/mesas-v9.mjs (NOT the live mesas.mjs).
Placement table + polygon/drift helpers are taken from the given base module (the live v8 file, read only)."""
import sys, os
d = os.path.dirname(os.path.abspath(__file__))
base = open(sys.argv[1]).read(); out = sys.argv[2]
assert not out.endswith("/mesas.mjs"), "never write the live module in place (learn/failures.md 17:16)"
layout = base[base.index("// avenue frame"):base.index("function loadTex")]
helpers = base[base.index("function insidePoly"):base.index("export async function mountMesas")]
src = open(f"{d}/head.js").read() + layout + open(f"{d}/mat.js").read() + helpers + open(f"{d}/mount.js").read()
open(out, "w").write(src); print("wrote", out, len(src))
