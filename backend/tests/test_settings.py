from app.settings.config import Settings, get_settings


def test_settings_load_defaults() -> None:
    settings = Settings()
    assert settings.app_name.startswith("ForgeGate")
    assert settings.api_base == "/v1"


def test_get_settings_is_cached() -> None:
    a = get_settings()
    b = get_settings()
    assert a is b
