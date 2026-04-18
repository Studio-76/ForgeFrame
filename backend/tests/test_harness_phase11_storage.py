from pathlib import Path

from app.harness.service import get_harness_service
from app.settings.config import get_settings


def test_harness_service_uses_file_backend_when_configured(monkeypatch, tmp_path: Path) -> None:
    get_harness_service.cache_clear()
    get_settings.cache_clear()
    monkeypatch.setenv("FORGEGATE_HARNESS_STORAGE_BACKEND", "file")
    monkeypatch.setenv("FORGEGATE_HARNESS_PROFILES_PATH", str(tmp_path / "profiles.json"))
    monkeypatch.setenv("FORGEGATE_HARNESS_RUNS_PATH", str(tmp_path / "runs.json"))

    service = get_harness_service()
    snapshot = service.export_snapshot()

    assert snapshot["storage_backend"] == "file"

    get_harness_service.cache_clear()
    get_settings.cache_clear()


def test_harness_service_postgres_requires_postgres_url(monkeypatch) -> None:
    get_harness_service.cache_clear()
    get_settings.cache_clear()
    monkeypatch.setenv("FORGEGATE_HARNESS_STORAGE_BACKEND", "postgresql")
    monkeypatch.setenv("FORGEGATE_HARNESS_POSTGRES_URL", "sqlite:///tmp.db")

    try:
        get_harness_service()
        raised = False
    except ValueError as exc:
        raised = True
        assert "postgresql://" in str(exc)

    assert raised is True

    get_harness_service.cache_clear()
    get_settings.cache_clear()
