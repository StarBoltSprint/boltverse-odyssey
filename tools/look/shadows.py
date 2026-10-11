"""Feature 5 — static shadows stay in the bake. The shadow map is only for movers.

Map ≤ 1024, PCF soft, autoUpdate off, no tint.
"""


def build(key_path, out_dir, sky=None, light=None, plates=None, game=None):
    return {
        "id": "shadows",
        "enabled": True,
        "flag": "shadows",
        "mapSize": 1024,
        "type": "PCFSoftShadowMap",
        "autoUpdate": False,
        "staticCast": False,
        "movers": ["player", "npc", "drone", "bolt", "hero"],
        "neutral": True,
        "requests": [],
    }


def selftest(check):
    feat = build("k", "o")
    check(feat["mapSize"] <= 1024, "map")
    check(feat["autoUpdate"] is False and feat["staticCast"] is False, "static")
    check(feat["neutral"] is True, "neutral")
    check("rgb" not in feat and "requests" in feat, "no tint")
