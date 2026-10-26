"""Routing priority, refusals, and the NO AI YET marker."""

from boltverse_orchestrator import Part, load_parts, route
from boltverse_orchestrator.registry import registry_from_dict
from boltverse_orchestrator.router import NO_AI_YET

from paths import PARTS_PATH


def _ai(ai_id, family, status, cpu=None, **extra):
    row = {
        "id": ai_id,
        "name": ai_id,
        "family": family,
        "part": extra.get("part", family),
        "status_class": status,
        "input": extra.get("input", f"in-{ai_id}"),
        "output": extra.get("output", f"out-{ai_id}"),
        "cpu_s_per_call": cpu,
        "proposal": extra.get("proposal"),
    }
    return row


def _registry(rows):
    return registry_from_dict({"count": len(rows), "ais": rows}, source="synthetic")


def test_priority_validated_then_cpu_then_file_order():
    reg = _registry(
        [
            _ai("slow", "gadget", "validated", cpu=2.0),
            _ai("draft", "gadget", "in_progress", cpu=0.01),
            _ai("fast", "gadget", "validated", cpu=0.2),
            _ai("bad", "gadget", "failed", cpu=0.001),
            _ai("old", "gadget", "superseded", cpu=0.001),
            _ai("gone", "gadget", "checkpoint_missing", cpu=0.001),
        ]
    )
    decision = route([Part("g", "gadget")], reg).decisions[0]
    assert decision.ai.id == "fast"
    assert decision.input_interface == "in-fast"
    assert decision.output_interface == "out-fast"
    assert [alt.id for alt in decision.alternatives] == ["slow"]
    refused = {ai.id: reason for ai, reason in decision.refused}
    assert "never routed" in refused["bad"]
    assert "superseded" in refused["old"]
    assert "missing_weights" in refused["gone"]
    assert "checkpoint_missing" in refused["gone"]
    assert "allow_unvalidated" in refused["draft"]
    assert decision.marker is None

    opened = route([Part("g", "gadget")], reg, allow_unvalidated=True).decisions[0]
    assert opened.ai.id == "fast"
    assert [alt.id for alt in opened.alternatives] == ["slow", "draft"]
    assert "bad" in {ai.id for ai, _ in opened.refused}
    assert "draft" not in {ai.id for ai, _ in opened.refused}


def test_cpu_tie_keeps_earlier_registry_row():
    reg = _registry(
        [
            _ai("listed-first", "gadget", "validated", cpu=1.0),
            _ai("listed-second", "gadget", "validated", cpu=1.0),
        ]
    )
    decision = route([Part("g", "gadget")], reg).decisions[0]
    assert decision.ai.id == "listed-first"
    assert [alt.id for alt in decision.alternatives] == ["listed-second"]


def test_unknown_cpu_does_not_beat_a_recorded_time():
    reg = _registry(
        [
            _ai("untimed", "gadget", "validated", cpu=None),
            _ai("timed", "gadget", "validated", cpu=9.0),
        ]
    )
    decision = route([Part("g", "gadget")], reg).decisions[0]
    assert decision.ai.id == "timed"
    assert [alt.id for alt in decision.alternatives] == ["untimed"]


def test_failed_and_superseded_never_route_even_if_unvalidated_allowed():
    reg = _registry(
        [
            _ai("bad", "gadget", "failed", cpu=0.01, proposal="KEEP"),
            _ai("old", "gadget", "superseded", cpu=0.01, proposal="KEEP"),
        ]
    )
    for flag in (False, True):
        decision = route(
            [Part("g", "gadget")], reg, allow_unvalidated=flag
        ).decisions[0]
        assert decision.ai is None
        assert decision.marker == NO_AI_YET
        assert decision.input_interface is None
        assert decision.output_interface is None
        assert {ai.id for ai, _ in decision.refused} == {"bad", "old"}


def test_in_progress_only_with_the_flag():
    reg = _registry([_ai("draft", "gadget", "in_progress", cpu=0.2)])
    closed = route([Part("g", "gadget")], reg).decisions[0]
    assert closed.marker == NO_AI_YET
    assert closed.ai is None
    opened = route([Part("g", "gadget")], reg, allow_unvalidated=True).decisions[0]
    assert opened.ai.id == "draft"
    assert opened.marker is None


def test_no_ai_yet_when_nothing_matches():
    reg = _registry([_ai("barrel-B2", "barrel", "validated", cpu=0.01)])
    decision = route([Part("main-engine", "engine")], reg).decisions[0]
    assert decision.marker == NO_AI_YET
    assert decision.ai is None
    assert decision.refused == ()
    assert "engine" in decision.why
    assert "No registry entry" in decision.why


def test_keep_proposal_does_not_save_a_failed_ai(registry):
    pieces = registry.matches("plinth-pieces")
    champion = next(ai for ai in pieces if ai.id == "plinth-pieces-D")
    assert champion.proposal == "KEEP"
    assert champion.status == "failed"
    decision = route([Part("blocks", "plinth-pieces")], registry).decisions[0]
    assert decision.marker == NO_AI_YET
    assert decision.ai is None
    assert any(ai.id == "plinth-pieces-D" for ai, _ in decision.refused)


def test_simple_ship_against_the_real_registry(registry):
    parts = load_parts(PARTS_PATH)
    plan = route(parts, registry)
    by_type = {item.part.part_type: item for item in plan.decisions}
    for missing in ("hull/body", "wing", "engine", "antenna"):
        assert by_type[missing].marker == NO_AI_YET
        assert by_type[missing].ai is None
        assert by_type[missing].refused == ()
    barrel = by_type["barrel"]
    assert barrel.ai.id == "barrel-B2"
    assert barrel.input_interface == registry.get("barrel-B2").input
    assert barrel.output_interface == registry.get("barrel-B2").output
    assert [alt.id for alt in barrel.alternatives] == []
    assert [ai.id for ai, _ in barrel.refused] == ["barrel-B1"]
    assert "superseded" in barrel.refused[0][1]
    door = by_type["door"]
    assert door.marker == NO_AI_YET
    assert [ai.id for ai, _ in door.refused] == ["door-D1", "door-D2"]
    plinth = by_type["plinth"]
    assert plinth.ai.id == "plinth-shape-v2"
    assert [alt.id for alt in plinth.alternatives] == ["plinth-camera-v1"]
    assert "NO AI YET" in plan.summary
    assert "barrel-B2" in plan.summary

    opened = route(parts, registry, allow_unvalidated=True)
    door_open = next(item for item in opened.decisions if item.part.part_type == "door")
    assert door_open.ai.id == "door-D2"
    assert [ai.id for ai, _ in door_open.refused] == ["door-D1"]


def test_crate_is_reported_not_invented(registry):
    decision = route([Part("supply-crate", "crate")], registry).decisions[0]
    assert decision.marker == NO_AI_YET
    assert decision.ai is None
    assert decision.refused[0][0].id == "crate-AIs-v1"
    assert "missing_weights" in decision.refused[0][1]


def test_router_method_matches_the_function(registry):
    from boltverse_orchestrator.router import Router

    parts = [Part("water-barrel", "barrel")]
    via_fn = route(parts, registry)
    via_obj = Router(registry).route(parts)
    assert via_obj.decisions[0].ai.id == via_fn.decisions[0].ai.id == "barrel-B2"
