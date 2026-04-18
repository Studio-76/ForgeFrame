"""Tests for nadirclaw.oauth — PKCE helpers, token validation, config resolution."""

import base64
import hashlib

import pytest

from nadirclaw.oauth import (
    _generate_code_challenge,
    _generate_code_verifier,
    _parse_openai_redirect_url,
    login_openai,
    validate_anthropic_setup_token,
)


class TestPKCE:
    def test_verifier_length(self):
        verifier = _generate_code_verifier()
        assert 43 <= len(verifier) <= 128

    def test_verifier_is_url_safe(self):
        verifier = _generate_code_verifier()
        # Should only contain URL-safe base64 characters (no padding)
        assert "=" not in verifier
        assert "+" not in verifier
        assert "/" not in verifier

    def test_challenge_matches_verifier(self):
        verifier = _generate_code_verifier()
        challenge = _generate_code_challenge(verifier)

        # Manually compute expected challenge
        digest = hashlib.sha256(verifier.encode("utf-8")).digest()
        expected = base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")
        assert challenge == expected

    def test_different_verifiers_produce_different_challenges(self):
        v1 = _generate_code_verifier()
        v2 = _generate_code_verifier()
        assert v1 != v2
        assert _generate_code_challenge(v1) != _generate_code_challenge(v2)


class TestAnthropicSetupToken:
    def test_valid_token(self):
        token = "sk-ant-oat01-" + "x" * 80
        assert validate_anthropic_setup_token(token) is None

    def test_empty_token(self):
        error = validate_anthropic_setup_token("")
        assert error is not None
        assert "empty" in error.lower()

    def test_wrong_prefix(self):
        error = validate_anthropic_setup_token("sk-ant-wrong-" + "x" * 80)
        assert error is not None
        assert "sk-ant-oat01-" in error

    def test_too_short(self):
        error = validate_anthropic_setup_token("sk-ant-oat01-short")
        assert error is not None
        assert "short" in error.lower()

    def test_whitespace_trimmed(self):
        token = "  sk-ant-oat01-" + "x" * 80 + "  "
        assert validate_anthropic_setup_token(token) is None


class TestGeminiClientConfig:
    def test_env_var_override(self, monkeypatch):
        from nadirclaw.oauth import _resolve_gemini_client_config

        monkeypatch.setenv("NADIRCLAW_GEMINI_OAUTH_CLIENT_ID", "test-client-id")
        monkeypatch.setenv("NADIRCLAW_GEMINI_OAUTH_CLIENT_SECRET", "test-secret")

        config = _resolve_gemini_client_config()
        assert config["client_id"] == "test-client-id"
        assert config["client_secret"] == "test-secret"

    def test_no_gemini_cli_returns_empty(self, monkeypatch):
        from nadirclaw.oauth import _resolve_gemini_client_config

        # Clear all env vars
        for key in (
            "NADIRCLAW_GEMINI_OAUTH_CLIENT_ID",
            "OPENCLAW_GEMINI_OAUTH_CLIENT_ID",
            "GEMINI_CLI_OAUTH_CLIENT_ID",
        ):
            monkeypatch.delenv(key, raising=False)
        # Mock shutil.which to return None (no gemini CLI)
        monkeypatch.setattr("nadirclaw.oauth.shutil.which", lambda _: None)

        config = _resolve_gemini_client_config()
        assert config == {}


class TestOpenAIHeadlessOAuth:
    def test_parse_redirect_success(self):
        code = _parse_openai_redirect_url(
            "http://localhost:1455/auth/callback?code=abc123&state=st",
            expected_state="st",
            expected_redirect_uri="http://localhost:1455/auth/callback",
        )
        assert code == "abc123"

    @pytest.mark.parametrize(
        "url, expected_error",
        [
            ("", "No redirect URL provided"),
            ("not-a-url", "Invalid redirect URL format"),
            ("https://localhost:1455/auth/callback?code=a&state=st", "scheme does not match"),
            ("http://localhost:1455/wrong?code=a&state=st", "path does not match"),
            ("http://localhost:1455/auth/callback?state=st", "No authorization code"),
            ("http://localhost:1455/auth/callback?error=access_denied&state=st", "Authorization failed"),
            ("http://localhost:1455/auth/callback?code=a&state=wrong", "State mismatch"),
        ],
    )
    def test_parse_redirect_errors(self, url, expected_error):
        with pytest.raises(RuntimeError, match=expected_error):
            _parse_openai_redirect_url(
                url,
                expected_state="st",
                expected_redirect_uri="http://localhost:1455/auth/callback",
            )

    def test_headless_login_exchanges_token(self, monkeypatch):
        monkeypatch.setattr("nadirclaw.oauth.secrets.token_urlsafe", lambda n=32: "fixed-state")
        monkeypatch.setattr("builtins.input", lambda _prompt="": "http://localhost:1455/auth/callback?code=abc&state=fixed-state")

        class _Resp:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def read(self):
                return b'{"access_token":"tok","refresh_token":"ref","expires_in":111}'

        captured = {}

        def _fake_urlopen(req, timeout=30):
            captured["data"] = req.data.decode("utf-8")
            return _Resp()

        monkeypatch.setattr("urllib.request.urlopen", _fake_urlopen)
        out = login_openai(timeout=1, auth_mode="headless")
        assert out["access_token"] == "tok"
        assert "redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback" in captured["data"]

    def test_headless_login_invalid_mode(self):
        with pytest.raises(RuntimeError, match="Unsupported auth_mode"):
            login_openai(auth_mode="invalid-mode")

    def test_browser_mode_uses_localhost_redirect(self, monkeypatch):
        monkeypatch.setattr("nadirclaw.oauth.secrets.token_urlsafe", lambda n=32: "browser-state")

        opened = {}
        monkeypatch.setattr("nadirclaw.oauth.webbrowser.open", lambda url: opened.setdefault("url", url))

        class _Queue:
            def get(self, timeout=None):
                return {"code": "abc", "state": "browser-state"}

        class _Server:
            def shutdown(self):
                opened["shutdown"] = True

        monkeypatch.setattr("nadirclaw.oauth._start_callback_server", lambda timeout, bind_host="localhost": (_Server(), _Queue()))

        class _Resp:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def read(self):
                return b'{"access_token":"tok","refresh_token":"ref","expires_in":3600}'

        monkeypatch.setattr("urllib.request.urlopen", lambda req, timeout=30: _Resp())
        out = login_openai(timeout=1, auth_mode="browser")
        assert out["access_token"] == "tok"
        assert "redirect_uri=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback" in opened["url"]
        assert opened["shutdown"] is True
