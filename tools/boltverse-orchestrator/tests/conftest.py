"""Fixtures for the offline suite."""

import pytest

from paths import REGISTRY_PATH


@pytest.fixture
def registry():
    from boltverse_orchestrator import load_registry

    return load_registry(REGISTRY_PATH)
