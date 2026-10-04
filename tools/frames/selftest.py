"""Synthetic defects for the 2026-10-04 frame gates. No Imagine calls."""

from __future__ import annotations

import sys

import numpy as np

from heroes import check_heroes, parse_must_show
from pixels import (
    foot_contact,
    ground_defects,
    hotspot_fixes,
    sky_defects,
    stair_crown,
    surface_mag,
    untextured,
)

FAILS = []


def check(name, cond, detail=""):
    if cond:
        print("PASS " + name)
    else:
        FAILS.append(name)
        print("FAIL " + name + (" " + detail if detail else ""))


def rgb(h, w, value):
    img = np.zeros((h, w, 3), np.uint8)
    img[:] = value
    return img


def noise(h, w, lo, hi, rng):
    return rng.integers(lo, hi, size=(h, w, 3), dtype=np.uint8)


def kinds(report):
    return {hit["kind"] for hit in report["hits"]}


def test_foot():
    rng = np.random.default_rng(1)
    h, w = 160, 200
    sky = rgb(h, w, (190, 200, 210))
    ground = noise(h, w, 20, 180, rng)
    img = sky.copy()
    img[120:] = ground[120:]
    solid = noise(60, 50, 15, 55, rng)
    img[40:100, 70:120] = solid
    gap = foot_contact(img)
    check("float foot fails", bool(gap["hits"]), str(gap))

    seated = sky.copy()
    seated[120:] = ground[120:]
    seated[70:150, 70:120] = noise(80, 50, 15, 55, rng)
    gap2 = foot_contact(seated)
    check("seated foot passes", not gap2["hits"], str(gap2))

    small = foot_contact(rgb(16, 16, 0))
    check("small frame skipped", small["skipped"] == "small")

    vista = sky.copy()
    vista[120:] = ground[120:]
    vista[0:30, 40:150] = noise(30, 110, 20, 50, rng)
    far = foot_contact(vista)
    check("open sky under a far solid passes", not far["hits"], str(far))


def test_untextured():
    rng = np.random.default_rng(2)
    img = noise(160, 200, 30, 200, rng)
    img[40:100, 30:110] = 0
    img[48:60, 40:55] = rng.integers(0, 8, size=(12, 15, 3), dtype=np.uint8)
    found = untextured(img)
    check("jagged black fails", any(h["kind"] == "black" for h in found["hits"]), str(found["hits"][:2]))

    night = noise(160, 200, 40, 180, rng)
    night[:70] = (8, 10, 14)
    night_found = untextured(night)
    check("night sky band passes", not night_found["hits"] and night_found["skyIgnored"] >= 1, str(night_found))

    dark = noise(160, 200, 0, 40, rng)
    check("textured dark passes", not untextured(dark)["hits"])

    flat = noise(160, 200, 40, 180, rng)
    flat[20:100, 20:140] = (70, 72, 68)
    flat_found = untextured(flat)
    check("flat untextured fails", any(h["kind"] == "flat" for h in flat_found["hits"]), str(flat_found["hits"][:2]))


def test_sky():
    rng = np.random.default_rng(3)
    band = rgb(140, 180, (80, 90, 110))
    band[:24] = (18, 16, 14)
    band[24:] = noise(116, 180, 40, 160, rng)
    sky = sky_defects(band)
    check("zenith band fails", "zenith_band" in kinds(sky), str(sky["zenith"]))

    busy = noise(140, 180, 20, 220, rng)
    check("busy zenith passes", "zenith_band" not in kinds(sky_defects(busy)))

    rect = rgb(140, 180, (100, 110, 130))
    rect[30:90, 40:120] = (30, 40, 55)
    rect_sky = sky_defects(rect)
    check("slice rectangle fails", "slice_rect" in kinds(rect_sky), str(rect_sky["rectangles"]))

    over = rgb(140, 180, (100, 110, 130))
    edge = (12, 12, 12)
    over[20:23, 20:100] = edge
    over[77:80, 20:100] = edge
    over[20:80, 20:23] = edge
    over[20:80, 97:100] = edge
    over[40:43, 55:145] = edge
    over[105:108, 55:145] = edge
    over[40:108, 55:58] = edge
    over[40:108, 142:145] = edge
    over_sky = sky_defects(over)
    check("overlapping panels fail", "panel" in kinds(over_sky), str(over_sky["panels"]))

    streak = noise(140, 180, 70, 100, rng)
    streak[:, 90:93] = 230
    streak_sky = sky_defects(streak)
    check("vertical streak fails", "streak" in kinds(streak_sky), str(streak_sky["streaks"]))


def test_ground():
    rng = np.random.default_rng(4)
    hard = noise(160, 200, 40, 200, rng)
    hard[:70] = (30, 32, 36)
    hard_rep = ground_defects(hard)
    check("hard horizon fails", "hard_line" in kinds(hard_rep), str(hard_rep["hits"]))

    void = noise(160, 200, 25, 210, rng)
    void[70:92] = (12, 12, 12)
    void_rep = ground_defects(void)
    check("void band fails", "void_band" in kinds(void_rep), str(void_rep["hits"]))

    cracked = noise(160, 200, 10, 240, rng)
    check("cracked ground passes", not ground_defects(cracked)["hits"])


def test_stair():
    h, w = 120, 160
    img = rgb(h, w, (210, 215, 220))
    for x in range(20, 140):
        step = 28 + ((x - 20) // 8) * 5
        img[step:, x] = (40, 36, 30)
    stair = stair_crown(img)
    check("stair crown fails", stair["stair"], str(stair))

    smooth = rgb(h, w, (210, 215, 220))
    for x in range(w):
        edge = 20 + x  # one pixel down per column, past the measured band when tall
        if edge < h:
            smooth[edge:, x] = (40, 36, 30)
    smooth_rep = stair_crown(smooth)
    check("smooth diagonal passes", not smooth_rep["stair"], str(smooth_rep))


def test_heroes():
    brief = "## Must show\n- a ringed planet over the mesas\n- the gate\n"
    check("parser keeps the planet", parse_must_show(brief) == ["a ringed planet over the mesas", "the gate"])
    sky = rgb(80, 80, (20, 30, 50))
    images = {"wide.jpg": sky}
    shows = {"ringed planet": {"shot": "wide.jpg", "box": [10, 10, 40, 30]}}
    missing = check_heroes(brief, shows, images)
    check("missing planet fails", missing["result"] == "FAIL", str(missing["rows"]))
    named = check_heroes("## Notes\nno heroes here\n", {}, {})
    check("empty brief is n/a", named["result"] == "n/a", str(named))


def test_mag():
    mag = surface_mag(70.0, 0.85, 1600, 48.08)
    check("close hull mag above 1", mag is not None and mag > 1, str(mag))
    fixes = hotspot_fixes(mag, 0.85, 1.0, 70.0)
    text = " ".join(fixes)
    check("fix names a farther camera", "move the camera out to" in text, text)
    check("fix names a smaller scale", "set scale to" in text, text)
    check("fix names a recook", "recook the skin" in text and "do not enlarge" in text, text)


def main():
    test_foot()
    test_untextured()
    test_sky()
    test_ground()
    test_stair()
    test_heroes()
    test_mag()
    if FAILS:
        print("FAIL " + str(len(FAILS)) + " " + ", ".join(FAILS))
        return 1
    print("PASS frames selftest")
    return 0


if __name__ == "__main__":
    sys.exit(main())
