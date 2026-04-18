"""Test setup for the phase-2 backend scaffold."""

from fastapi.testclient import TestClient

from app.main import app


def make_client() -> TestClient:
    return TestClient(app)
