#!/usr/bin/env python3
"""add-wip records a non-placeable object; KEEP is refused; check/list ignore _wip."""
import json, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools.library.library import main  # noqa: E402
from tools.library.resolve import iter_manifests  # noqa: E402

ok = []
with tempfile.TemporaryDirectory() as d:
    d = Path(d); lib = d / "lib"
    base = {"id": "t", "kind": "kit-relief", "kit_spec": "s.json", "metrics": {}, "reason": "AD FAIL"}
    (d / "w.json").write_text(json.dumps({**base, "status": "WIP"}))
    ok.append(main(["add-wip", "--wip", str(d / "w.json"), "--library", str(lib)]) == 0)
    ok.append((lib / "_wip" / "t" / "manifest.json").is_file())
    ok.append(iter_manifests(lib) == [])
    (d / "k.json").write_text(json.dumps({**base, "status": "KEEP"}))
    ok.append(main(["add-wip", "--wip", str(d / "k.json"), "--library", str(lib)]) == 1)
    (d / "m.json").write_text(json.dumps({"id": "x", "status": "WIP"}))
    ok.append(main(["add-wip", "--wip", str(d / "m.json"), "--library", str(lib)]) == 1)
print(f"{sum(ok)}/{len(ok)} rows pass")
sys.exit(0 if all(ok) else 1)
