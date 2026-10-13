# tools/sky-pack
`python3 skypack.py [--src DIR --out DIR]`: latest final plate per section -> KTX2 ASTC 4x4 sRGB, levels 2 (base + star-preserving mip 1 from tools/sky-magnification/starmip.py, passed via --mipmap --levels 2; not --genmipmap). ktxinfo-checked; writes pack-report.json.
