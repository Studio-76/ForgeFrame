"""Test setup for ForgeGate backend tests."""

import pytest
from fastapi.testclient import TestClient

from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.main import app


@pytest.fixture(autouse=True)
def _reset_runtime_caches() -> None:
    clear_runtime_dependency_caches()


def make_client() -> TestClient:
    return TestClient(app)
