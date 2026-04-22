import httpx
import pytest

from app.auth.oauth.openai import resolve_codex_auth_state
from app.api.admin.control_plane import get_control_plane_service
from app.auth.oauth.gemini import resolve_gemini_auth_state
from app.providers.anthropic.adapter import AnthropicAdapter
from app.providers.base import (
    ChatDispatchRequest,
    ProviderCapabilities,
    ProviderConflictError,
    ProviderConfigurationError,
    ProviderNotImplementedError,
    ProviderNotReadyError,
    ProviderPayloadTooLargeError,
    ProviderRateLimitError,
    ProviderResourceGoneError,
    ProviderStreamInterruptedError,
    ProviderTimeoutError,
    ProviderUnsupportedMediaTypeError,
    ProviderUnavailableError,
    ProviderUnsupportedFeatureError,
)
from app.providers.forgegate_baseline import ForgeGateBaselineAdapter
from app.providers.gemini.adapter import GeminiAdapter
from app.providers.ollama.adapter import OllamaAdapter
from app.providers.openai_api.adapter import OpenAIAPIAdapter
from app.providers.openai_codex.adapter import OpenAICodexAdapter
from app.providers.registry import ProviderRegistry
from app.providers.openai_streaming import finalize_openai_tool_calls, merge_openai_tool_call_chunks
from app.settings.config import Settings
from app.usage.models import TokenUsage
from app.usage.service import UsageAccountingService


def _assert_forwarded_request_metadata(headers: dict[str, str]) -> None:
    assert headers["X-ForgeGate-Request-Id"] == "req_provider_headers_1"
    assert headers["X-ForgeGate-Correlation-Id"] == "corr_provider_headers_1"
    assert headers["X-ForgeGate-Trace-Id"] == "trace_provider_headers_1"
    assert headers["X-ForgeGate-Span-Id"] == "span_provider_headers_1"
    assert headers["X-ForgeGate-Route"] == "/v1/chat/completions"


def test_baseline_provider_capabilities_are_declared() -> None:
    adapter = ForgeGateBaselineAdapter()
    assert isinstance(adapter.capabilities, ProviderCapabilities)
    assert adapter.capabilities.streaming is True
    assert adapter.capabilities.external is False


def test_openai_provider_capabilities_and_readiness() -> None:
    adapter = OpenAIAPIAdapter(Settings(openai_api_key="abc"))
    assert adapter.capabilities.external is True
    assert adapter.capabilities.streaming is True
    assert adapter.is_ready() is True


def test_openai_provider_reports_invalid_base_url_as_not_ready() -> None:
    adapter = OpenAIAPIAdapter(Settings(openai_api_key="abc", openai_api_base_url="not-a-url"))
    assert adapter.is_ready() is False
    assert adapter.readiness_reason() == "FORGEGATE_OPENAI_API_BASE_URL must be an absolute http(s) URL."


def test_anthropic_provider_axis_stays_outside_current_product_axes() -> None:
    adapter = AnthropicAdapter(Settings(anthropic_api_key="anthropic-key"))
    assert adapter.capabilities.provider_axis == "unmapped_native_runtime"


@pytest.mark.parametrize("base_url", ("", "not-a-url"))
def test_anthropic_provider_reports_invalid_base_url_as_not_ready(base_url: str) -> None:
    adapter = AnthropicAdapter(Settings(anthropic_api_key="anthropic-key", anthropic_base_url=base_url))
    assert adapter.is_ready() is False
    assert adapter.readiness_reason() == "FORGEGATE_ANTHROPIC_BASE_URL must be an absolute http(s) URL."


def test_gemini_provider_reports_invalid_probe_base_url_as_not_ready() -> None:
    adapter = GeminiAdapter(
        Settings(
            gemini_auth_mode="oauth",
            gemini_oauth_access_token="token",
            gemini_probe_enabled=True,
            gemini_probe_base_url="not-a-url",
        )
    )
    assert adapter.is_ready() is False
    assert adapter.readiness_reason() == "FORGEGATE_GEMINI_PROBE_BASE_URL must be an absolute http(s) URL."


def test_codex_provider_reports_invalid_bridge_base_url_as_not_ready() -> None:
    adapter = OpenAICodexAdapter(
        Settings(
            openai_codex_auth_mode="oauth",
            openai_codex_oauth_access_token="token",
            openai_codex_bridge_enabled=True,
            openai_codex_base_url="not-a-url",
        )
    )
    assert adapter.is_ready() is False
    assert adapter.readiness_reason() == "FORGEGATE_OPENAI_CODEX_BASE_URL must be an absolute http(s) URL."


def test_openai_adapter_forwards_request_metadata_as_headers(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _MockResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = "ok"

        @staticmethod
        def json() -> dict:
            return {
                "model": "gpt-4.1-mini",
                "choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 2, "completion_tokens": 1, "total_tokens": 3},
            }

    def _mock_post(*args, **kwargs):
        captured["headers"] = kwargs.get("headers", {})
        return _MockResponse()

    monkeypatch.setattr("app.providers.openai_api.adapter.httpx.post", _mock_post)
    adapter = OpenAIAPIAdapter(Settings(openai_api_key="abc"))
    adapter.create_chat_completion(
        ChatDispatchRequest(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": "hello"}],
            request_metadata={
                "request_id": "req_provider_headers_1",
                "correlation_id": "corr_provider_headers_1",
                "trace_id": "trace_provider_headers_1",
                "span_id": "span_provider_headers_1",
                "route": "/v1/chat/completions",
            },
        )
    )

    headers = captured["headers"]
    _assert_forwarded_request_metadata(headers)


def test_gemini_adapter_forwards_request_metadata_as_headers(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _MockResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = "ok"

        @staticmethod
        def json() -> dict:
            return {
                "model": "gemini-2.5-flash",
                "choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 2, "completion_tokens": 1, "total_tokens": 3},
            }

    def _mock_post(*args, **kwargs):
        captured["headers"] = kwargs.get("headers", {})
        return _MockResponse()

    monkeypatch.setattr("app.providers.gemini.adapter.httpx.post", _mock_post)
    adapter = GeminiAdapter(
        Settings(
            gemini_auth_mode="oauth",
            gemini_oauth_access_token="token",
            gemini_probe_enabled=True,
        )
    )
    adapter.create_chat_completion(
        ChatDispatchRequest(
            model="gemini-2.5-flash",
            messages=[{"role": "user", "content": "hello"}],
            request_metadata={
                "request_id": "req_provider_headers_1",
                "correlation_id": "corr_provider_headers_1",
                "trace_id": "trace_provider_headers_1",
                "span_id": "span_provider_headers_1",
                "route": "/v1/chat/completions",
            },
        )
    )

    _assert_forwarded_request_metadata(captured["headers"])


def test_anthropic_adapter_forwards_request_metadata_as_headers(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _MockResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = "ok"

        @staticmethod
        def json() -> dict:
            return {
                "model": "claude-sonnet-4-20250514",
                "content": [{"type": "text", "text": "ok"}],
                "usage": {"input_tokens": 2, "output_tokens": 1},
                "stop_reason": "end_turn",
            }

    def _mock_post(*args, **kwargs):
        captured["headers"] = kwargs.get("headers", {})
        return _MockResponse()

    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.post", _mock_post)
    adapter = AnthropicAdapter(Settings(anthropic_api_key="anthropic-key"))
    adapter.create_chat_completion(
        ChatDispatchRequest(
            model="claude-sonnet-4-20250514",
            messages=[{"role": "user", "content": "hello"}],
            request_metadata={
                "request_id": "req_provider_headers_1",
                "correlation_id": "corr_provider_headers_1",
                "trace_id": "trace_provider_headers_1",
                "span_id": "span_provider_headers_1",
                "route": "/v1/chat/completions",
            },
        )
    )

    _assert_forwarded_request_metadata(captured["headers"])


def test_anthropic_adapter_translates_data_url_image_blocks_to_messages_api(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _MockResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = "ok"

        @staticmethod
        def json() -> dict:
            return {
                "model": "claude-sonnet-4-20250514",
                "content": [{"type": "text", "text": "ok"}],
                "usage": {"input_tokens": 4, "output_tokens": 1},
                "stop_reason": "end_turn",
            }

    def _mock_post(*args, **kwargs):
        captured["payload"] = kwargs.get("json", {})
        return _MockResponse()

    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.post", _mock_post)
    adapter = AnthropicAdapter(Settings(anthropic_api_key="anthropic-key"))
    adapter.create_chat_completion(
        ChatDispatchRequest(
            model="claude-sonnet-4-20250514",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "describe this"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8B9YkAAAAASUVORK5CYII="
                            },
                        },
                    ],
                }
            ],
        )
    )

    assert captured["payload"]["messages"] == [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "describe this"},
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8B9YkAAAAASUVORK5CYII=",
                    },
                },
            ],
        }
    ]


def test_codex_adapter_forwards_request_metadata_as_headers(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _MockResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = "ok"

        @staticmethod
        def json() -> dict:
            return {
                "model": "gpt-5.3-codex",
                "choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 2, "completion_tokens": 1, "total_tokens": 3},
            }

    def _mock_post(*args, **kwargs):
        captured["headers"] = kwargs.get("headers", {})
        return _MockResponse()

    monkeypatch.setattr("app.providers.openai_codex.adapter.httpx.post", _mock_post)
    adapter = OpenAICodexAdapter(
        Settings(
            openai_codex_auth_mode="oauth",
            openai_codex_oauth_access_token="token",
            openai_codex_bridge_enabled=True,
        )
    )
    adapter.create_chat_completion(
        ChatDispatchRequest(
            model="gpt-5.3-codex",
            messages=[{"role": "user", "content": "hello"}],
            request_metadata={
                "request_id": "req_provider_headers_1",
                "correlation_id": "corr_provider_headers_1",
                "trace_id": "trace_provider_headers_1",
                "span_id": "span_provider_headers_1",
                "route": "/v1/chat/completions",
            },
        )
    )

    _assert_forwarded_request_metadata(captured["headers"])


def test_ollama_adapter_forwards_request_metadata_as_headers(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _ReadyResponse:
        status_code = 200
        text = "ok"

    class _MockResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = "ok"

        @staticmethod
        def json() -> dict:
            return {
                "model": "llama3.2",
                "choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 2, "completion_tokens": 1, "total_tokens": 3},
            }

    def _mock_get(*args, **kwargs):
        return _ReadyResponse()

    def _mock_post(*args, **kwargs):
        captured["headers"] = kwargs.get("headers", {})
        return _MockResponse()

    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_get)
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.post", _mock_post)
    adapter = OllamaAdapter(Settings(ollama_base_url="http://ollama.invalid/v1"))
    adapter.create_chat_completion(
        ChatDispatchRequest(
            model="llama3.2",
            messages=[{"role": "user", "content": "hello"}],
            request_metadata={
                "request_id": "req_provider_headers_1",
                "correlation_id": "corr_provider_headers_1",
                "trace_id": "trace_provider_headers_1",
                "span_id": "span_provider_headers_1",
                "route": "/v1/chat/completions",
            },
        )
    )

    _assert_forwarded_request_metadata(captured["headers"])


def test_anthropic_stream_forwards_request_metadata_as_headers(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _MockStreamResponse:
        status_code = 200
        headers = {"content-type": "text/event-stream"}
        text = ""

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        @staticmethod
        def iter_lines():
            return iter(
                [
                    "event: content_block_delta",
                    'data: {"delta":{"text":"ok"}}',
                    "event: message_delta",
                    'data: {"delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":2,"output_tokens":1}}',
                    "event: message_stop",
                    "data: {}",
                ]
            )

    def _mock_stream(*args, **kwargs):
        captured["headers"] = kwargs.get("headers", {})
        return _MockStreamResponse()

    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.stream", _mock_stream)
    adapter = AnthropicAdapter(Settings(anthropic_api_key="anthropic-key"))
    list(
        adapter.stream_chat_completion(
            ChatDispatchRequest(
                model="claude-sonnet-4-20250514",
                messages=[{"role": "user", "content": "hello"}],
                stream=True,
                request_metadata={
                    "request_id": "req_provider_headers_1",
                    "correlation_id": "corr_provider_headers_1",
                    "trace_id": "trace_provider_headers_1",
                    "span_id": "span_provider_headers_1",
                    "route": "/v1/chat/completions",
                },
            )
        )
    )

    _assert_forwarded_request_metadata(captured["headers"])


def test_anthropic_adapter_maps_tool_use_to_openai_tool_calls(monkeypatch) -> None:
    class _MockResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = "ok"

        @staticmethod
        def json() -> dict:
            return {
                "model": "claude-sonnet-4-20250514",
                "content": [
                    {
                        "type": "tool_use",
                        "id": "toolu_1",
                        "name": "lookup",
                        "input": {"q": "forgegate"},
                    }
                ],
                "usage": {"input_tokens": 5, "output_tokens": 2, "total_tokens": 7},
                "stop_reason": "tool_use",
            }

    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.post", lambda *args, **kwargs: _MockResponse())
    adapter = AnthropicAdapter(Settings(anthropic_api_key="anthropic-key"))
    result = adapter.create_chat_completion(
        ChatDispatchRequest(
            model="claude-sonnet-4-20250514",
            messages=[{"role": "user", "content": "use a tool"}],
            tools=[{"type": "function", "function": {"name": "lookup"}}],
            tool_choice="auto",
        )
    )
    assert result.finish_reason == "tool_calls"
    assert result.tool_calls == [
        {
            "id": "toolu_1",
            "type": "function",
            "function": {"name": "lookup", "arguments": "{\"q\":\"forgegate\"}"},
        }
    ]


def test_anthropic_stream_maps_tool_use_blocks_to_openai_tool_calls(monkeypatch) -> None:
    class _MockStreamResponse:
        status_code = 200
        headers = {"content-type": "text/event-stream"}
        text = ""

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        @staticmethod
        def iter_lines():
            return iter(
                [
                    "event: message_start",
                    'data: {"type":"message_start","message":{"usage":{"input_tokens":5,"output_tokens":0}}}',
                    "event: content_block_start",
                    'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"lookup"}}',
                    "event: content_block_delta",
                    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"q\\":\\"forge"}}',
                    "event: content_block_delta",
                    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"gate\\"}"}}',
                    "event: message_delta",
                    'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"input_tokens":5,"output_tokens":2,"total_tokens":7}}',
                    "event: message_stop",
                    'data: {"type":"message_stop"}',
                ]
            )

    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.stream", lambda *args, **kwargs: _MockStreamResponse())
    adapter = AnthropicAdapter(Settings(anthropic_api_key="anthropic-key"))
    events = list(
        adapter.stream_chat_completion(
            ChatDispatchRequest(
                model="claude-sonnet-4-20250514",
                messages=[{"role": "user", "content": "use a tool"}],
                stream=True,
                tools=[{"type": "function", "function": {"name": "lookup"}}],
                tool_choice="auto",
            )
        )
    )
    assert [event.event for event in events] == ["done"]
    assert events[-1].finish_reason == "tool_calls"
    assert events[-1].usage is not None and events[-1].usage.total_tokens == 7
    assert events[-1].tool_calls == [
        {
            "id": "toolu_1",
            "type": "function",
            "function": {"name": "lookup", "arguments": "{\"q\":\"forgegate\"}"},
        }
    ]


def test_gemini_stream_forwards_request_metadata_as_headers(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _MockStreamResponse:
        status_code = 200
        headers = {"content-type": "text/event-stream"}
        text = ""

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        @staticmethod
        def iter_lines():
            return iter(
                [
                    'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":1,"total_tokens":3}}',
                    "data: [DONE]",
                ]
            )

    def _mock_stream(*args, **kwargs):
        captured["headers"] = kwargs.get("headers", {})
        return _MockStreamResponse()

    monkeypatch.setattr("app.providers.gemini.adapter.httpx.stream", _mock_stream)
    adapter = GeminiAdapter(
        Settings(
            gemini_auth_mode="oauth",
            gemini_oauth_access_token="token",
            gemini_probe_enabled=True,
        )
    )
    list(
        adapter.stream_chat_completion(
            ChatDispatchRequest(
                model="gemini-2.5-flash",
                messages=[{"role": "user", "content": "hello"}],
                stream=True,
                request_metadata={
                    "request_id": "req_provider_headers_1",
                    "correlation_id": "corr_provider_headers_1",
                    "trace_id": "trace_provider_headers_1",
                    "span_id": "span_provider_headers_1",
                    "route": "/v1/chat/completions",
                },
            )
        )
    )

    _assert_forwarded_request_metadata(captured["headers"])


def test_codex_stream_forwards_request_metadata_as_headers(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _MockStreamResponse:
        status_code = 200
        headers = {"content-type": "text/event-stream"}
        text = ""

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        @staticmethod
        def iter_lines():
            return iter(
                [
                    'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":1,"total_tokens":3}}',
                    "data: [DONE]",
                ]
            )

    def _mock_stream(*args, **kwargs):
        captured["headers"] = kwargs.get("headers", {})
        return _MockStreamResponse()

    monkeypatch.setattr("app.providers.openai_codex.adapter.httpx.stream", _mock_stream)
    adapter = OpenAICodexAdapter(
        Settings(
            openai_codex_auth_mode="oauth",
            openai_codex_oauth_access_token="token",
            openai_codex_bridge_enabled=True,
        )
    )
    list(
        adapter.stream_chat_completion(
            ChatDispatchRequest(
                model="gpt-5.3-codex",
                messages=[{"role": "user", "content": "hello"}],
                stream=True,
                request_metadata={
                    "request_id": "req_provider_headers_1",
                    "correlation_id": "corr_provider_headers_1",
                    "trace_id": "trace_provider_headers_1",
                    "span_id": "span_provider_headers_1",
                    "route": "/v1/chat/completions",
                },
            )
        )
    )

    _assert_forwarded_request_metadata(captured["headers"])


def test_ollama_stream_forwards_request_metadata_as_headers(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _ReadyResponse:
        status_code = 200
        text = "ok"

    class _MockStreamResponse:
        status_code = 200
        headers = {"content-type": "text/event-stream"}
        text = ""

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        @staticmethod
        def iter_lines():
            return iter(
                [
                    'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":1,"total_tokens":3}}',
                    "data: [DONE]",
                ]
            )

    def _mock_get(*args, **kwargs):
        return _ReadyResponse()

    def _mock_stream(*args, **kwargs):
        captured["headers"] = kwargs.get("headers", {})
        return _MockStreamResponse()

    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_get)
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.stream", _mock_stream)
    adapter = OllamaAdapter(Settings(ollama_base_url="http://ollama.invalid/v1"))
    list(
        adapter.stream_chat_completion(
            ChatDispatchRequest(
                model="llama3.2",
                messages=[{"role": "user", "content": "hello"}],
                stream=True,
                request_metadata={
                    "request_id": "req_provider_headers_1",
                    "correlation_id": "corr_provider_headers_1",
                    "trace_id": "trace_provider_headers_1",
                    "span_id": "span_provider_headers_1",
                    "route": "/v1/chat/completions",
                },
            )
        )
    )

    _assert_forwarded_request_metadata(captured["headers"])


def test_ollama_provider_requires_reachable_runtime_endpoint(monkeypatch) -> None:
    def _mock_get(*args, **kwargs):
        url = str(args[0]) if args else "http://ollama.invalid/v1/models"
        raise httpx.RequestError("connect failed", request=httpx.Request("GET", url))

    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_get)
    adapter = OllamaAdapter(Settings(ollama_base_url="http://ollama.invalid/v1"))

    assert adapter.is_ready() is False
    assert "runtime endpoint is unreachable" in (adapter.readiness_reason() or "")


def test_ollama_provider_recovers_after_readiness_cache_window(monkeypatch) -> None:
    current_time = {"value": 100.0}
    probe_calls = {"count": 0}

    class _ReadyResponse:
        status_code = 200
        text = "ok"

    def _mock_get(*args, **kwargs):
        probe_calls["count"] += 1
        if probe_calls["count"] == 1:
            url = str(args[0]) if args else "http://ollama.invalid/v1/models"
            raise httpx.RequestError("connect failed", request=httpx.Request("GET", url))
        return _ReadyResponse()

    monkeypatch.setattr("app.providers.ollama.adapter.monotonic", lambda: current_time["value"])
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_get)
    adapter = OllamaAdapter(Settings(ollama_base_url="http://ollama.invalid/v1"))

    assert adapter.is_ready() is False
    assert "runtime endpoint is unreachable" in (adapter.readiness_reason() or "")
    assert probe_calls["count"] == 1

    current_time["value"] += OllamaAdapter._READINESS_CACHE_TTL_SECONDS + 0.1

    assert adapter.is_ready() is True
    assert adapter.readiness_reason() is None
    assert probe_calls["count"] == 2


def test_ollama_provider_keeps_first_readiness_snapshot_for_immediate_reason_lookup(monkeypatch) -> None:
    monotonic_values = iter((100.0, 101.3, 101.3))
    probe_calls = {"count": 0}

    class _ReadyResponse:
        status_code = 200
        text = "ok"

    def _mock_get(*args, **kwargs):
        probe_calls["count"] += 1
        return _ReadyResponse()

    monkeypatch.setattr("app.providers.ollama.adapter.monotonic", lambda: next(monotonic_values))
    monkeypatch.setattr("app.providers.ollama.adapter.httpx.get", _mock_get)
    adapter = OllamaAdapter(Settings(ollama_base_url="http://ollama.invalid/v1"))

    assert adapter.is_ready() is True
    assert adapter.readiness_reason() is None
    assert probe_calls["count"] == 1


def test_not_implemented_error_has_structured_metadata() -> None:
    error = ProviderNotImplementedError("openai_api")
    assert error.provider == "openai_api"
    assert error.error_type == "provider_not_implemented"


def test_provider_error_types_for_new_semantics() -> None:
    assert ProviderUnsupportedFeatureError("openai", "stream").error_type == "provider_unsupported_feature"
    assert ProviderNotReadyError("openai").error_type == "provider_not_ready"
    assert ProviderStreamInterruptedError("openai", "boom").error_type == "provider_stream_interrupted"
    assert ProviderRateLimitError("openai", "rl").error_type == "provider_rate_limited"
    assert ProviderConflictError("openai", "conflict").error_type == "provider_conflict"
    assert ProviderTimeoutError("openai", "timeout").error_type == "provider_timeout"
    assert ProviderResourceGoneError("openai", "gone").error_type == "provider_resource_gone"
    assert ProviderPayloadTooLargeError("openai", "big").error_type == "provider_payload_too_large"
    assert ProviderUnsupportedMediaTypeError("openai", "media").error_type == "provider_unsupported_media_type"
    assert ProviderUnavailableError("openai", "down").error_type == "provider_unavailable"


def test_codex_auth_state_resolution() -> None:
    settings = Settings(
        openai_codex_auth_mode="oauth",
        openai_codex_oauth_mode="device_hosted_code",
        openai_codex_oauth_access_token="token",
    )
    state = resolve_codex_auth_state(settings)
    assert state.auth_mode == "oauth"
    assert state.oauth_mode == "device_hosted_code"
    assert state.ready is True
    assert state.credential_type == "oauth_access_token"
    assert state.oauth_flow_support == "external_token_only"
    assert state.oauth_operator_truth is not None
    assert "does not initiate or complete" in state.oauth_operator_truth
    assert "device/hosted code" in state.oauth_operator_truth


def test_codex_adapter_reports_not_ready_without_credentials() -> None:
    adapter = OpenAICodexAdapter(Settings(openai_codex_auth_mode="oauth", openai_codex_oauth_access_token=""))
    assert adapter.is_ready() is False
    reason = adapter.readiness_reason() or ""
    assert "expects a pre-issued access token" in reason
    assert "does not initiate or complete" in reason


def test_usage_accounting_service_supports_actual_and_avoided_cost_axes() -> None:
    usage_service = UsageAccountingService(Settings())
    usage = TokenUsage(input_tokens=1000, output_tokens=500, total_tokens=1500)

    openai_cost = usage_service.costs_for_provider(provider="openai_api", usage=usage)
    codex_cost = usage_service.costs_for_provider(provider="openai_codex", usage=usage, oauth_mode=True)

    assert openai_cost.actual_cost > 0
    assert codex_cost.actual_cost == 0
    assert codex_cost.hypothetical_cost > 0
    assert codex_cost.avoided_cost == codex_cost.hypothetical_cost


def test_provider_configuration_error_type() -> None:
    error = ProviderConfigurationError("openai_api", "missing key")
    assert error.error_type == "provider_configuration_error"


def test_gemini_auth_state_resolution() -> None:
    settings = Settings(gemini_auth_mode="oauth", gemini_oauth_access_token="token")
    state = resolve_gemini_auth_state(settings)
    assert state.auth_mode == "oauth"
    assert state.ready is True
    assert state.credential_type == "oauth_access_token"


def test_gemini_provider_capabilities_follow_active_auth_mode() -> None:
    oauth_adapter = GeminiAdapter(Settings(gemini_auth_mode="oauth", gemini_oauth_access_token="token"))
    api_key_adapter = GeminiAdapter(Settings(gemini_auth_mode="api_key", gemini_api_key="gemini-key"))

    assert oauth_adapter.capabilities.oauth_required is True
    assert api_key_adapter.capabilities.oauth_required is False


def test_gemini_provider_status_follows_active_auth_mode() -> None:
    provider_status = ProviderRegistry(
        Settings(
            gemini_auth_mode="api_key",
            gemini_api_key="gemini-key",
            gemini_probe_enabled=True,
        )
    ).get_provider_status("gemini")

    assert provider_status["ready"] is True
    assert provider_status["oauth_required"] is False
    assert provider_status["capabilities"]["oauth_required"] is False


def test_codex_bridge_partial_runtime_executes_with_mocked_httpx(monkeypatch) -> None:
    class _MockResponse:
        status_code = 200

        @staticmethod
        def json() -> dict:
            return {
                "model": "gpt-5.3-codex",
                "choices": [
                    {
                        "message": {
                            "content": "ok",
                            "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "lookup", "arguments": "{\"q\":\"forgegate\"}"}}],
                        },
                        "finish_reason": "tool_calls",
                    }
                ],
                "usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8},
            }

        text = "ok"

    def _mock_post(*args, **kwargs):
        return _MockResponse()

    monkeypatch.setattr("app.providers.openai_codex.adapter.httpx.post", _mock_post)
    adapter = OpenAICodexAdapter(
        Settings(
            openai_codex_auth_mode="oauth",
            openai_codex_oauth_access_token="token",
            openai_codex_bridge_enabled=True,
        )
    )
    result = adapter.create_chat_completion(
        ChatDispatchRequest(
            model="gpt-5.3-codex",
            messages=[{"role": "user", "content": "hi"}],
            stream=False,
            tools=[{"type": "function", "function": {"name": "lookup"}}],
            tool_choice="auto",
        )
    )
    assert result.provider == "openai_codex"
    assert result.content == "ok"
    assert result.finish_reason == "tool_calls"
    assert result.tool_calls[0]["function"]["name"] == "lookup"


def test_oauth_target_status_for_antigravity_stays_partial_without_live_probe_evidence() -> None:
    service = get_control_plane_service()
    service._settings.antigravity_oauth_access_token = "token"  # type: ignore[attr-defined]
    service._settings.antigravity_probe_enabled = True  # type: ignore[attr-defined]
    status = service._oauth_target_status("antigravity")
    assert status.configured is True
    assert status.probe_enabled is True
    assert status.readiness == "partial"
    assert status.evidence.live_probe.status == "missing"


def test_gemini_bridge_partial_runtime_executes_with_mocked_httpx(monkeypatch) -> None:
    class _MockResponse:
        status_code = 200
        text = "ok"

        @staticmethod
        def json() -> dict:
            return {
                "model": "gemini-2.5-flash",
                "choices": [
                    {
                        "message": {
                            "content": "gemini-ok",
                            "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "lookup", "arguments": "{\"q\":\"gemini\"}"}}],
                        },
                        "finish_reason": "tool_calls",
                    }
                ],
                "usage": {"prompt_tokens": 4, "completion_tokens": 2, "total_tokens": 6},
            }

    def _mock_post(*args, **kwargs):
        return _MockResponse()

    monkeypatch.setattr("app.providers.gemini.adapter.httpx.post", _mock_post)
    adapter = GeminiAdapter(
        Settings(
            gemini_auth_mode="oauth",
            gemini_oauth_access_token="token",
            gemini_probe_enabled=True,
        )
    )
    result = adapter.create_chat_completion(
        ChatDispatchRequest(
            model="gemini-2.5-flash",
            messages=[{"role": "user", "content": "hi"}],
            stream=False,
            tools=[{"type": "function", "function": {"name": "lookup"}}],
            tool_choice="auto",
        )
    )
    assert result.provider == "gemini"
    assert result.content == "gemini-ok"
    assert result.finish_reason == "tool_calls"
    assert result.tool_calls[0]["function"]["name"] == "lookup"


def test_codex_stream_merges_tool_call_chunks_and_usage(monkeypatch) -> None:
    class _MockStreamResponse:
        status_code = 200
        headers = {"content-type": "text/event-stream"}
        text = ""

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        @staticmethod
        def iter_lines():
                return iter(
                    [
                        'data: {"choices":[{"delta":{"content":"cod","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"lookup","arguments":"{\\"q\\":"}}]}}]}',
                        'data: {"choices":[{"delta":{"content":"ex","tool_calls":[{"index":0,"function":{"arguments":"\\"forgegate\\"}"}}]},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}',
                        "data: [DONE]",
                    ]
                )

    monkeypatch.setattr("app.providers.openai_codex.adapter.httpx.stream", lambda *args, **kwargs: _MockStreamResponse())
    adapter = OpenAICodexAdapter(
        Settings(
            openai_codex_auth_mode="oauth",
            openai_codex_oauth_access_token="token",
            openai_codex_bridge_enabled=True,
        )
    )
    events = list(
        adapter.stream_chat_completion(
            ChatDispatchRequest(
                model="gpt-5.3-codex",
                messages=[{"role": "user", "content": "hi"}],
                stream=True,
                tools=[{"type": "function", "function": {"name": "lookup"}}],
                tool_choice="auto",
            )
        )
    )
    assert [event.event for event in events] == ["delta", "delta", "done"]
    assert events[-1].finish_reason == "tool_calls"
    assert events[-1].usage is not None and events[-1].usage.total_tokens == 7
    assert events[-1].tool_calls == [
        {
            "id": "call_1",
            "type": "function",
            "function": {"name": "lookup", "arguments": "{\"q\":\"forgegate\"}"},
        }
    ]


def test_gemini_stream_merges_tool_call_chunks_and_usage(monkeypatch) -> None:
    class _MockStreamResponse:
        status_code = 200
        headers = {"content-type": "text/event-stream"}
        text = ""

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        @staticmethod
        def iter_lines():
                return iter(
                    [
                        'data: {"choices":[{"delta":{"content":"gem","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"lookup","arguments":"{\\"q\\":"}}]}}]}',
                        'data: {"choices":[{"delta":{"content":"ini","tool_calls":[{"index":0,"function":{"arguments":"\\"bridge\\"}"}}]},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":4,"completion_tokens":2,"total_tokens":6}}',
                        "data: [DONE]",
                    ]
                )

    monkeypatch.setattr("app.providers.gemini.adapter.httpx.stream", lambda *args, **kwargs: _MockStreamResponse())
    adapter = GeminiAdapter(
        Settings(
            gemini_auth_mode="oauth",
            gemini_oauth_access_token="token",
            gemini_probe_enabled=True,
        )
    )
    events = list(
        adapter.stream_chat_completion(
            ChatDispatchRequest(
                model="gemini-2.5-flash",
                messages=[{"role": "user", "content": "hi"}],
                stream=True,
                tools=[{"type": "function", "function": {"name": "lookup"}}],
                tool_choice="auto",
            )
        )
    )
    assert [event.event for event in events] == ["delta", "delta", "done"]
    assert events[-1].finish_reason == "tool_calls"
    assert events[-1].usage is not None and events[-1].usage.total_tokens == 6
    assert events[-1].tool_calls == [
        {
            "id": "call_1",
            "type": "function",
            "function": {"name": "lookup", "arguments": "{\"q\":\"bridge\"}"},
        }
    ]


def test_codex_rate_limit_error_preserves_retry_after(monkeypatch) -> None:
    class _MockResponse:
        status_code = 429
        text = "slow down"
        headers = {"retry-after": "7"}

    monkeypatch.setattr("app.providers.openai_codex.adapter.httpx.post", lambda *args, **kwargs: _MockResponse())
    adapter = OpenAICodexAdapter(
        Settings(
            openai_codex_auth_mode="oauth",
            openai_codex_oauth_access_token="token",
            openai_codex_bridge_enabled=True,
        )
    )
    with pytest.raises(ProviderRateLimitError) as exc_info:
        adapter.create_chat_completion(ChatDispatchRequest(model="gpt-5.3-codex", messages=[{"role": "user", "content": "hi"}], stream=False))
    assert exc_info.value.retry_after_seconds == 7


def test_gemini_rate_limit_error_preserves_retry_after(monkeypatch) -> None:
    class _MockResponse:
        status_code = 429
        text = "too many requests"
        headers = {"retry-after": "9"}

    monkeypatch.setattr("app.providers.gemini.adapter.httpx.post", lambda *args, **kwargs: _MockResponse())
    adapter = GeminiAdapter(
        Settings(
            gemini_auth_mode="oauth",
            gemini_oauth_access_token="token",
            gemini_probe_enabled=True,
        )
    )
    with pytest.raises(ProviderRateLimitError) as exc_info:
        adapter.create_chat_completion(ChatDispatchRequest(model="gemini-2.5-flash", messages=[{"role": "user", "content": "hi"}], stream=False))
    assert exc_info.value.retry_after_seconds == 9


def test_retry_after_http_date_is_parsed_for_openai_compatible_adapters() -> None:
    value = "Wed, 21 Oct 2099 07:28:00 GMT"
    assert OpenAIAPIAdapter._parse_retry_after_seconds(value) is not None
    assert OpenAICodexAdapter._parse_retry_after_seconds(value) is not None


def test_openai_stream_tool_call_chunks_are_merged() -> None:
    merged: dict[int, dict[str, object]] = {}
    merge_openai_tool_call_chunks(
        merged,
        [
            {"index": 0, "id": "call_1", "type": "function", "function": {"name": "lookup", "arguments": "{\"q\":"}},
            {"index": 0, "function": {"arguments": "\"forgegate\"}"}},
        ],
    )
    assert finalize_openai_tool_calls(merged) == [
        {
            "id": "call_1",
            "type": "function",
            "function": {"name": "lookup", "arguments": "{\"q\":\"forgegate\"}"},
        }
    ]
