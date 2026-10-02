#!/usr/bin/env python3
"""Load and check a biome kit. Any biome/kits/<id>.json that passes is a kit.

The geometry block is the owner lock (level horizon 50%, 8×60° sky slices
at a 45° step, one sun, ortho ground tiles). Paint fields are what a player fills.

  python3 tools/kits/kit.py check
  python3 tools/kits/kit.py check --file biome/kits/howling-eclipse.json
  python3 tools/kits/kit.py show --id howling-eclipse

Exit 0 when every checked kit is complete. Exit 1 when a kit is incomplete.
Exit 2 when the command is not understood.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
KITS = ROOT / "biome" / "kits"
SCHEMA_PATH = KITS / "_template" / "schema.json"
FAILURES = ROOT / "learn" / "failures.md"
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
BANNED_KEYS = {"suns", "lights", "meshes", "models", "particles", "shaders"}
ORBIT_TYPES = {"still-ring", "orbit-still"}

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def load_kit(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def failure_headings() -> str:
    return FAILURES.read_text(encoding="utf-8")


def lcm_seconds(durations: list[float]) -> float:
    """Same 0.1 s LCM as tools/sky/pixels.py. Imported logic, not a second rule."""
    tenths = [max(1, int(round(float(d) * 10.0))) for d in durations]
    acc = tenths[0]
    for item in tenths[1:]:
        acc = acc // math.gcd(acc, item) * item
    return acc / 10.0


def close(got, want, eps: float = 1e-6) -> bool:
    try:
        return abs(float(got) - float(want)) <= eps
    except (TypeError, ValueError):
        return False


def token(value) -> str:
    number = float(value)
    if abs(number - round(number)) < 1e-6:
        return str(int(round(number)))
    return str(number)


def has_number(text: str, value) -> bool:
    word = token(value)
    return re.search(rf"(?<!\d){re.escape(word)}(?!\d)", text) is not None


def validate(kit: dict, schema: dict, headings: str, filename: str | None = None) -> list[str]:
    errors: list[str] = []
    if not isinstance(kit, dict):
        return ["kit is not an object"]

    for key in sorted(BANNED_KEYS & set(kit)):
        errors.append(f"banned key {key}")

    if kit.get("schema") != schema["kitSchema"]:
        errors.append(f"schema must be {schema['kitSchema']}")

    kit_id = kit.get("id")
    if not isinstance(kit_id, str) or not SLUG.match(kit_id):
        errors.append("id must be a lowercase slug")
    elif filename and filename not in {"kit", "_template"} and filename != kit_id:
        errors.append(f"id {kit_id} must match filename {filename}")

    for key in ("name", "timeOfDay", "paint"):
        if not isinstance(kit.get(key), str) or not kit[key].strip():
            errors.append(f"{key} is empty")

    geo = schema["geometry"]
    if kit.get("geometry") != geo:
        errors.append("geometry must match the template lock")

    sun = kit.get("sun")
    if not isinstance(sun, dict):
        errors.append("sun is missing")
    else:
        if sun.get("count") != geo["sunCount"]:
            errors.append("sun.count must be 1")
        azimuth = sun.get("azimuthDeg")
        elevation = sun.get("elevationDeg")
        kelvin = sun.get("kelvin")
        if not isinstance(azimuth, (int, float)) or isinstance(azimuth, bool) or not 0 <= float(azimuth) <= 360:
            errors.append("sun.azimuthDeg must be 0..360")
        if not isinstance(elevation, (int, float)) or isinstance(elevation, bool) or not -90 <= float(elevation) <= 90:
            errors.append("sun.elevationDeg must be -90..90")
        if not isinstance(kelvin, (int, float)) or isinstance(kelvin, bool) or not 1000 <= float(kelvin) <= 20000:
            errors.append("sun.kelvin must be 1000..20000")

    palette = kit.get("palette")
    if not isinstance(palette, dict):
        errors.append("palette is missing")
        palette = {}
    for key in ("sky", "ground", "accent"):
        if not isinstance(palette.get(key), str) or not HEX.match(palette.get(key) or ""):
            errors.append(f"palette.{key} must be #RRGGBB")
    for key, value in palette.items():
        if key == "guidance":
            continue
        if isinstance(value, str) and value and not HEX.match(value):
            errors.append(f"palette.{key} must be #RRGGBB")

    fog = kit.get("fog") if isinstance(kit.get("fog"), dict) else {}
    source = fog.get("colourSource") if isinstance(fog, dict) else None
    if not isinstance(source, str) or "Imagine" not in source:
        errors.append("fog.colourSource must name an Imagine sky or plate")
    elif HEX.match(source.strip()) or any(source.lower().find(str(v).lower()) >= 0 and HEX.match(str(v)) for v in palette.values() if isinstance(v, str) and HEX.match(v)):
        errors.append("fog.colourSource must be sampled from an Imagine plate, not a palette hex")

    play = schema["cameraPlay"]
    camera = kit.get("camera") if isinstance(kit.get("camera"), dict) else {}
    got_play = camera.get("play")
    if not isinstance(got_play, dict):
        errors.append("camera.play is missing")
    else:
        for key, want in play.items():
            if isinstance(want, bool):
                if got_play.get(key) is not want:
                    errors.append(f"camera.play.{key} must be {want}")
            elif isinstance(want, list):
                if got_play.get(key) != want:
                    errors.append(f"camera.play.{key} must be {want}")
            elif not close(got_play.get(key), want):
                errors.append(f"camera.play.{key} must be {want}")

    plates = camera.get("plates") if isinstance(camera.get("plates"), dict) else None
    if not isinstance(plates, dict):
        errors.append("camera.plates is missing")
        plates = {}
    for required in ("sky", "ground"):
        if required not in plates:
            errors.append(f"camera.plates.{required} is missing")

    allowed_types = set(schema["plateTypes"])
    for name, plate in plates.items():
        if not isinstance(plate, dict):
            errors.append(f"camera.plates.{name} is not an object")
            continue
        ptype = plate.get("type")
        if ptype not in allowed_types:
            errors.append(f"camera.plates.{name}.type must be one of {sorted(allowed_types)}")
            continue
        if ptype == "ortho":
            if plate.get("horizon") is not False:
                errors.append(f"camera.plates.{name} ortho has no horizon")
            if "horizonFraction" in plate:
                errors.append(f"camera.plates.{name} ortho does not carry a horizon fraction")
            if name == "ground" and not close(plate.get("tileM"), schema["groundTileM"]):
                errors.append("ground tile must be 0.9 m")
        if "horizonFraction" in plate and not close(plate.get("horizonFraction"), geo["horizonFraction"]):
            errors.append(f"camera.plates.{name} horizon must be 0.5")
        if plate.get("level") is False:
            errors.append(f"camera.plates.{name} must stay level")
        if ptype in ORBIT_TYPES:
            orbit = schema["orbit"]
            if plate.get("count") != orbit["count"] or not close(plate.get("yawStepDeg"), orbit["yawStepDeg"]):
                errors.append(f"camera.plates.{name} must be 8 stills at a 45° step")
            if not close(plate.get("elevationDeg"), orbit["elevationDeg"]):
                errors.append(f"camera.plates.{name} elevation must be 18°")

    sky = plates.get("sky") if isinstance(plates.get("sky"), dict) else {}
    if sky.get("type") != "slice-ring":
        errors.append("sky plate type must be slice-ring")
    for key, want in (
        ("slices", geo["skySlices"]),
        ("hfovDeg", geo["hfovDeg"]),
        ("yawStepDeg", geo["yawStepDeg"]),
        ("horizonFraction", geo["horizonFraction"]),
    ):
        if not close(sky.get(key), want) and sky.get(key) != want:
            errors.append(f"sky plate {key} must be {want}")
    if sky.get("level") is not True:
        errors.append("sky plate must be level")

    plan = kit.get("skySlicePlan") if isinstance(kit.get("skySlicePlan"), dict) else {}
    if not plan:
        errors.append("skySlicePlan is missing")
    else:
        if plan.get("count") != geo["skySlices"]:
            errors.append("skySlicePlan.count must be 8")
        if not close(plan.get("hfovDeg"), geo["hfovDeg"]):
            errors.append("skySlicePlan.hfovDeg must be 60")
        if not close(plan.get("yawStepDeg"), geo["yawStepDeg"]):
            errors.append("skySlicePlan.yawStepDeg must be 45")
        if not close(plan.get("overlapDeg"), float(geo["hfovDeg"]) - float(geo["yawStepDeg"])):
            errors.append("skySlicePlan.overlapDeg must be 15")
        if not close(plan.get("horizonFraction"), geo["horizonFraction"]) or plan.get("level") is not True:
            errors.append("skySlicePlan horizon must be level at 0.5")
        if plan.get("headingsDeg") != schema["headingsDeg"]:
            errors.append("skySlicePlan.headingsDeg must be 0,45,90,135,180,225,270,315")

    loops = kit.get("livingLoops")
    roles = set(schema["livingLoopRoles"])
    if not isinstance(loops, list) or len(loops) < 2:
        errors.append("livingLoops needs at least two Imagine layers")
        loops = []
    durations = []
    for i, layer in enumerate(loops):
        if not isinstance(layer, dict):
            errors.append(f"livingLoops[{i}] is not an object")
            continue
        if layer.get("role") not in roles:
            errors.append(f"livingLoops[{i}].role must be one of {sorted(roles)}")
        duration = layer.get("durationSec")
        if not isinstance(duration, (int, float)) or isinstance(duration, bool) or float(duration) <= 0:
            errors.append(f"livingLoops[{i}].durationSec must be > 0")
        else:
            durations.append(float(duration))
    if len(durations) >= 2:
        period = lcm_seconds(durations)
        if period < float(schema["combinedRepeatMinSec"]):
            errors.append(f"livingLoops combined repeat {period}s is under {schema['combinedRepeatMinSec']}s")

    preamble = kit.get("promptPreamble") if isinstance(kit.get("promptPreamble"), str) else ""
    if not preamble.strip():
        errors.append("promptPreamble is empty")
    else:
        if isinstance(kit.get("name"), str) and kit["name"] and kit["name"] not in preamble:
            errors.append("promptPreamble must include the kit name")
        if "one sun" not in preamble.lower():
            errors.append("promptPreamble must say one sun")
        if "Imagine" not in preamble or "ortho" not in preamble.lower() or "50%" not in preamble:
            errors.append("promptPreamble must carry Imagine, ortho, and horizon 50%")
        if isinstance(sun, dict):
            for label, key in (("azimuth", "azimuthDeg"), ("elevation", "elevationDeg"), ("kelvin", "kelvin")):
                if isinstance(sun.get(key), (int, float)) and not isinstance(sun.get(key), bool):
                    if not has_number(preamble, sun[key]):
                        errors.append(f"promptPreamble must include sun {label} {token(sun[key])}")
        if not has_number(preamble, 8) or not has_number(preamble, 60) or not has_number(preamble, 45):
            errors.append("promptPreamble must include 8 slices, 60° HFOV, and a 45° step")

    blob = " ".join(
        str(kit.get(key) or "") for key in ("name", "timeOfDay", "paint", "promptPreamble")
    ).casefold()
    hooks = kit.get("decreeHooks")
    if not isinstance(hooks, list) or not hooks:
        errors.append("decreeHooks is empty")
    else:
        for hook in hooks:
            if not isinstance(hook, str) or len(hook.strip()) < 3:
                errors.append("each decreeHook must be at least 3 characters")
            elif hook.casefold() not in blob:
                errors.append(f"decreeHook {hook} is not in the name, time, paint, or preamble")

    scale = kit.get("scale") if isinstance(kit.get("scale"), dict) else {}
    shoulder = scale.get("boltShoulder") if isinstance(scale.get("boltShoulder"), dict) else {}
    want_scale = schema["scale"]
    if not close(shoulder.get("withersFrac"), want_scale["withersFrac"]):
        errors.append("scale.boltShoulder.withersFrac must be 0.10")
    if shoulder.get("frame") != want_scale["frame"]:
        errors.append("scale.boltShoulder.frame must be 720×1600")
    if not close(shoulder.get("bodyWidthM"), want_scale["bodyWidthM"]):
        errors.append("scale.boltShoulder.bodyWidthM must be 0.7")
    if not close(shoulder.get("bodyRadiusM"), want_scale["bodyRadiusM"]):
        errors.append("scale.boltShoulder.bodyRadiusM must be 0.45")
    measure = shoulder.get("measure") if isinstance(shoulder.get("measure"), str) else ""
    if "shoulder" not in measure.lower():
        errors.append("scale.boltShoulder.measure must say shoulders")

    cited = []
    negatives = kit.get("negatives")
    if not isinstance(negatives, list):
        errors.append("negatives is missing")
        negatives = []
    for item in negatives:
        heading = item.get("heading") if isinstance(item, dict) else None
        if not isinstance(heading, str) or heading not in headings:
            errors.append(f"negative heading is not in learn/failures.md: {heading}")
        else:
            cited.append(heading)
    for heading in schema["requiredNegatives"]:
        if heading not in cited:
            errors.append(f"missing negative: {heading}")

    pixels = kit.get("pixels") if isinstance(kit.get("pixels"), dict) else {}
    if pixels.get("source") != "imagine":
        errors.append("pixels.source must be imagine")
    code_may = pixels.get("codeMay")
    if sorted(code_may or []) != sorted(schema["codeMay"]):
        errors.append("pixels.codeMay must be invisible relief, placement, physics, fog, grade, bloom")

    return errors


def kit_paths() -> list[Path]:
    return sorted(path for path in KITS.glob("*.json") if path.is_file())


def check_file(path: Path, schema: dict, headings: str) -> list[str]:
    try:
        kit = load_kit(path)
    except json.JSONDecodeError as exc:
        return [f"JSON: {exc}"]
    return validate(kit, schema, headings, filename=path.stem)


def check_tree(schema: dict, headings: str) -> list[tuple[str, list[str]]]:
    rows = []
    seen_ids: dict[str, str] = {}
    seen_examples: dict[str, str] = {}
    for path in kit_paths():
        errors = check_file(path, schema, headings)
        kit = {}
        try:
            kit = load_kit(path)
        except json.JSONDecodeError:
            pass
        kit_id = kit.get("id")
        if isinstance(kit_id, str) and kit_id:
            if kit_id in seen_ids:
                errors.append(f"duplicate id also in {seen_ids[kit_id]}")
            seen_ids[kit_id] = path.name
        example = kit.get("example")
        if example is not None:
            if not isinstance(example, str) or not example.strip():
                errors.append("example letter is empty")
            elif example in seen_examples:
                errors.append(f"duplicate example {example} also in {seen_examples[example]}")
            else:
                seen_examples[example] = path.name
        rows.append((path.name, errors))
    return rows


def hooks_for(kit_id: str) -> list[str]:
    path = KITS / f"{kit_id}.json"
    if not path.is_file():
        raise FileNotFoundError(kit_id)
    kit = load_kit(path)
    hooks = kit.get("decreeHooks") or []
    return [str(hook) for hook in hooks if isinstance(hook, str)]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Check biome kits against the template lock")
    parser.add_argument("command", nargs="?", default="check", choices=("check", "show"))
    parser.add_argument("--file", type=Path, help="One kit JSON, including the blank template")
    parser.add_argument("--id", help="Kit id for show")
    args = parser.parse_args(argv)
    schema = load_schema()
    headings = failure_headings()

    if args.command == "show":
        if not args.id:
            print("FAIL kit: show needs --id", file=sys.stderr)
            return 2
        path = KITS / f"{args.id}.json"
        if not path.is_file():
            print(f"FAIL kit: no {path}", file=sys.stderr)
            return 2
        errors = check_file(path, schema, headings)
        if errors:
            print("FAIL kit " + args.id, file=sys.stderr)
            for line in errors:
                print(f"  {line}", file=sys.stderr)
            return 1
        print(load_kit(path)["promptPreamble"])
        return 0

    if args.file:
        errors = check_file(args.file, schema, headings)
        name = args.file.name
        if errors:
            print(f"FAIL kit {name}")
            for line in errors:
                print(f"  {line}")
            return 1
        print(f"PASS kit {name}")
        return 0

    rows = check_tree(schema, headings)
    if not rows:
        print("FAIL kit: no biome/kits/*.json")
        return 1
    failed = False
    for name, errors in rows:
        if errors:
            failed = True
            print(f"FAIL kit {name}")
            for line in errors:
                print(f"  {line}")
        else:
            print(f"PASS kit {name}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
