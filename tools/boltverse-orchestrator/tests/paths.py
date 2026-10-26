"""Paths shared by the offline tests."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "examples" / "AI-REGISTRY.json"
PARTS_PATH = ROOT / "examples" / "simple_ship_parts.json"
