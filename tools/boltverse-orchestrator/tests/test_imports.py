"""The package may import numpy. Nothing else from outside the standard library."""

import ast
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "boltverse_orchestrator"

# Explicit ban list from the brief, on top of the stdlib check.
BANNED = {
    "torch",
    "torchvision",
    "tensorflow",
    "jax",
    "cv2",
    "PIL",
    "requests",
    "urllib3",
    "httpx",
    "aiohttp",
    "transformers",
    "sklearn",
    "scipy",
    "moge",
    "sam",
    "segment_anything",
}


def _imported_roots(path: Path) -> list[tuple[str, int, str]]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    found = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                found.append((path.name, node.lineno, alias.name.split(".")[0]))
        elif isinstance(node, ast.ImportFrom):
            if node.level and node.level > 0:
                continue
            if not node.module:
                continue
            found.append((path.name, node.lineno, node.module.split(".")[0]))
    return found


def test_source_imports_only_stdlib_and_numpy():
    stdlib = set(sys.stdlib_module_names)
    allowed = stdlib | {"numpy", "boltverse_orchestrator"}
    offenders = []
    saw_numpy = False
    for path in sorted(ROOT.rglob("*.py")):
        for filename, lineno, root in _imported_roots(path):
            if root == "numpy":
                saw_numpy = True
            if root in BANNED or root not in allowed:
                offenders.append(f"{filename}:{lineno} imports {root}")
    assert saw_numpy, "numpy should be the one third-party import"
    assert offenders == []


def test_importing_the_package_does_not_pull_banned_modules():
    banned_before = {name for name in BANNED if name in sys.modules}
    import boltverse_orchestrator
    import boltverse_orchestrator.adapters
    import boltverse_orchestrator.orchestrate
    import boltverse_orchestrator.registry
    import boltverse_orchestrator.router

    assert boltverse_orchestrator.__version__ == "0.1.0"
    pulled = {name for name in BANNED if name in sys.modules} - banned_before
    assert pulled == set()
    assert "numpy" in sys.modules
