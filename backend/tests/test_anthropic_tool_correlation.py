from fastapi.testclient import TestClient

from app.api.runtime.dependencies import clear_runtime_dependency_caches
from app.main import app
from app.providers.anthropic.adapter import AnthropicAdapter
from app.providers.base import ChatDispatchRequest
from app.settings.config import Settings


def _anthropic_tool_follow_up_messages() -> list[dict[str, object]]:
    return [
        {"role": "system", "content": "You are a weather assistant."},
        {"role": "user", "content": "What's the weather in Berlin?"},
        {
            "role": "assistant",
            "content": "",
            "tool_calls": [
                {
                    "id": "call_weather_1",
                    "type": "function",
                    "function": {
                        "name": "lookup_weather",
                        "arguments": "{\"city\":\"Berlin\"}",
                    },
                }
            ],
        },
        {
            "role": "tool",
            "tool_call_id": "call_weather_1",
            "content": "15C and cloudy",
        },
        {"role": "user", "content": "Answer for the user."},
    ]


def test_anthropic_adapter_preserves_openai_tool_call_correlation_in_follow_up_turns(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _MockResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = "ok"

        @staticmethod
        def json() -> dict[str, object]:
            return {
                "model": "claude-3-5-sonnet-latest",
                "content": [
                    {
                        "type": "tool_use",
                        "id": "call_weather_1",
                        "name": "lookup_weather",
                        "input": {"city": "Berlin"},
                    }
                ],
                "usage": {"input_tokens": 8, "output_tokens": 3},
                "stop_reason": "tool_use",
            }

    def _mock_post(*args, **kwargs):
        captured["json"] = kwargs.get("json", {})
        return _MockResponse()

    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.post", _mock_post)

    adapter = AnthropicAdapter(Settings(anthropic_api_key="anthropic-key"))
    result = adapter.create_chat_completion(
        ChatDispatchRequest(
            model="claude-3-5-sonnet-latest",
            messages=_anthropic_tool_follow_up_messages(),
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "lookup_weather",
                        "description": "Look up the weather.",
                        "parameters": {
                            "type": "object",
                            "properties": {"city": {"type": "string"}},
                            "required": ["city"],
                        },
                    },
                }
            ],
            tool_choice="auto",
        )
    )

    assert result.finish_reason == "tool_calls"
    assert result.tool_calls == [
        {
            "id": "call_weather_1",
            "type": "function",
            "function": {
                "name": "lookup_weather",
                "arguments": "{\"city\":\"Berlin\"}",
            },
        }
    ]

    assert captured["json"] == {
        "model": "claude-3-5-sonnet-latest",
        "messages": [
            {"role": "user", "content": "What's the weather in Berlin?"},
            {
                "role": "assistant",
                "content": [
                    {
                        "type": "tool_use",
                        "id": "call_weather_1",
                        "name": "lookup_weather",
                        "input": {"city": "Berlin"},
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": "call_weather_1",
                        "content": "15C and cloudy",
                    },
                    {"type": "text", "text": "Answer for the user."},
                ],
            },
        ],
        "max_tokens": 1024,
        "stream": False,
        "system": "You are a weather assistant.",
        "tools": [
            {
                "name": "lookup_weather",
                "description": "Look up the weather.",
                "input_schema": {
                    "type": "object",
                    "properties": {"city": {"type": "string"}},
                    "required": ["city"],
                },
            }
        ],
        "tool_choice": {"type": "auto"},
    }


def test_chat_endpoint_preserves_tool_call_fields_for_anthropic_follow_up_turns(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class _MockResponse:
        status_code = 200
        headers = {"content-type": "application/json"}
        text = "ok"

        @staticmethod
        def json() -> dict[str, object]:
            return {
                "model": "claude-3-5-sonnet-latest",
                "content": [
                    {
                        "type": "tool_use",
                        "id": "call_weather_1",
                        "name": "lookup_weather",
                        "input": {"city": "Berlin"},
                    }
                ],
                "usage": {"input_tokens": 8, "output_tokens": 3},
                "stop_reason": "tool_use",
            }

    def _mock_post(*args, **kwargs):
        captured["json"] = kwargs.get("json", {})
        return _MockResponse()

    monkeypatch.setenv("FORGEGATE_ANTHROPIC_ENABLED", "true")
    monkeypatch.setenv("FORGEGATE_ANTHROPIC_API_KEY", "anthropic-key")
    clear_runtime_dependency_caches()
    monkeypatch.setattr("app.providers.anthropic.adapter.httpx.post", _mock_post)

    client = TestClient(app)
    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "claude-3-5-sonnet-latest",
            "messages": _anthropic_tool_follow_up_messages(),
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "lookup_weather",
                        "description": "Look up the weather.",
                        "parameters": {
                            "type": "object",
                            "properties": {"city": {"type": "string"}},
                            "required": ["city"],
                        },
                    },
                }
            ],
            "tool_choice": "auto",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["choices"][0]["finish_reason"] == "tool_calls"
    assert body["choices"][0]["message"]["tool_calls"][0]["id"] == "call_weather_1"

    translated_messages = captured["json"]["messages"]
    assert translated_messages[1]["content"][0]["id"] == "call_weather_1"
    assert translated_messages[2]["content"][0]["tool_use_id"] == "call_weather_1"
