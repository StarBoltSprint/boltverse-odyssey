"""Registry load, query, and the read-only promise."""

import dataclasses
import hashlib
import json

import pytest

from boltverse_orchestrator import load_registry
from boltverse_orchestrator.registry import registry_from_dict

from paths import REGISTRY_PATH


def test_real_registry_counts_and_statuses(registry):
    assert registry.count == 26
    assert len(registry.ais) == 26
    assert len({ai.id for ai in registry.ais}) == 26
    counts = {}
    for ai in registry.ais:
        counts[ai.status] = counts.get(ai.status, 0) + 1
    assert counts == {
        "validated": 3,
        "failed": 13,
        "superseded": 7,
        "in_progress": 2,
        "missing_weights": 1,
    }
    crate = registry.get("crate-AIs-v1")
    assert crate.status_raw == "checkpoint_missing"
    assert crate.status == "missing_weights"


def test_query_by_family_and_alias(registry):
    assert [ai.id for ai in registry.matches("barrel")] == ["barrel-B2", "barrel-B1"]
    assert [ai.id for ai in registry.matches("Tonneau")] == ["barrel-B2", "barrel-B1"]
    assert [ai.id for ai in registry.matches("porte")] == ["door-D1", "door-D2"]
    assert [ai.id for ai in registry.matches("socle")][0] == "plinth-shape-v2"
    assert registry.matches("tint")[0].family == "texture"
    assert registry.matches("texture/tint")[0].id == "texture-box"
    assert registry.matches("pieces")[0].family == "plinth-pieces"
    assert registry.matches("engine") == ()
    assert registry.matches("wing") == ()
    assert registry.matches("antenna") == ()
    assert [ai.id for ai in registry.routable("barrel")] == ["barrel-B2"]
    assert registry.routable("door") == ()
    assert [ai.id for ai in registry.routable("door", allow_unvalidated=True)] == ["door-D2"]
    assert registry.routable("crate", allow_unvalidated=True) == ()


def test_load_does_not_touch_the_file(tmp_path):
    dest = tmp_path / "AI-REGISTRY.json"
    original = REGISTRY_PATH.read_bytes()
    dest.write_bytes(original)
    before = hashlib.sha256(dest.read_bytes()).hexdigest()
    loaded = load_registry(dest)
    after = hashlib.sha256(dest.read_bytes()).hexdigest()
    assert before == after
    assert loaded.source == str(dest)
    assert not hasattr(loaded, "save")
    assert not hasattr(loaded, "delete")
    with pytest.raises(dataclasses.FrozenInstanceError):
        loaded.ais[0].status = "failed"
    with pytest.raises(TypeError):
        loaded.pipelines["extra"] = "nope"


def test_duplicate_id_is_rejected():
    row = {
        "id": "same",
        "family": "barrel",
        "status_class": "validated",
        "input": "in",
        "output": "out",
    }
    with pytest.raises(ValueError, match="duplicate"):
        registry_from_dict({"count": 2, "ais": [row, dict(row)]})


def test_count_mismatch_is_rejected():
    row = {"id": "only", "family": "barrel", "status_class": "validated"}
    with pytest.raises(ValueError, match="count"):
        registry_from_dict({"count": 4, "ais": [row]})


def test_file_on_disk_matches_the_upload_shape():
    data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    assert data["count"] == 26
    assert data["ais"][0]["id"] == "plinth-shape-v2"
    assert "plinth-shape-v2" in REGISTRY_PATH.read_text(encoding="utf-8")
