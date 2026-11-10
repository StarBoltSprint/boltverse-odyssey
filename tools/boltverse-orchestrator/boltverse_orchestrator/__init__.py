"""Boltverse orchestrator v0: route parts to in-house AIs.

This package does not load checkpoints and does not call an outside model.
"""

from .adapters import (
    Adapter,
    CommandAdapter,
    MockAdapter,
    StubAdapter,
    adapter_for,
)
from .orchestrate import main, run_plan
from .registry import AIEntry, Registry, load_registry
from .router import Part, Plan, load_parts, route

__version__ = "0.1.0"

__all__ = [
    "AIEntry",
    "Adapter",
    "CommandAdapter",
    "MockAdapter",
    "Part",
    "Plan",
    "Registry",
    "StubAdapter",
    "adapter_for",
    "load_parts",
    "load_registry",
    "main",
    "route",
    "run_plan",
]
