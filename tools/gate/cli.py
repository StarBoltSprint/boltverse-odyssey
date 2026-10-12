"""python3 -m tools.gate <command> ...

Commands: streaks, clean, feather, icicles, repetition, uvmirror, morph, volume, sliver, outline.
Exit 0 when the check passes, 1 when it fails, 2 when the invocation is wrong.
"""
import json
import sys


def main(argv=None):
    a = list(sys.argv[1:] if argv is None else argv)
    if not a or a[0] in ("-h", "--help"):
        print(
            "usage: python3 -m tools.gate <streaks|clean|feather|icicles|repetition|uvmirror|morph|volume|sliver|outline> ...",
            file=sys.stderr,
        )
        return 2
    cmd, rest = a[0], a[1:]
    if cmd == "streaks":
        from tools.gate.streaks import main as run
        return run(rest)
    if cmd == "clean":
        from tools.gate.clean import main as run
        return run(rest)
    if cmd == "feather":
        from tools.gate.feather import main as run
        return run(rest)
    if cmd == "icicles":
        from tools.gate.icicles import main as run
        return run(rest)
    if cmd == "repetition":
        from tools.gate.repetition import main as run
        return run(rest)
    if cmd == "uvmirror":
        from tools.gate.uvmirror import main as run
        return run(rest)
    if cmd == "morph":
        from tools.gate.morph import main as run
        return run(rest)
    if cmd == "volume":
        from tools.gate.volume import oblique_profile
        if not rest:
            print("usage: volume <renderdir> [--out j]", file=sys.stderr)
            return 2
        r = oblique_profile(rest[0])
        print(json.dumps(r))
        if "--out" in rest:
            json.dump(r, open(rest[rest.index("--out") + 1], "w"), indent=1)
        return 0 if r["pass"] else 1
    if cmd == "sliver":
        from tools.gate.quality import load_obj_tris, triangle_quality
        if not rest:
            print("usage: sliver <mesh.obj> [--out j]", file=sys.stderr)
            return 2
        r = triangle_quality(load_obj_tris(rest[0]))
        print(json.dumps(r))
        if "--out" in rest:
            json.dump(r, open(rest[rest.index("--out") + 1], "w"), indent=1)
        return 0 if r["pass"] else 1
    if cmd == "outline":
        from tools.gate.outline import main as run
        return run(rest)
    print("unknown command " + cmd, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
