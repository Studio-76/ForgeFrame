import json
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.main import app
from app.providers import ProviderBadRequestError, ProviderStreamEvent
from app.providers.openai_api.adapter import OpenAIAPIAdapter
from app.storage.runtime_responses_repository import (
    NativeResponseEventORM,
    NativeResponseFollowObjectORM,
    NativeResponseItemORM,
    NativeResponseMappingORM,
    NativeResponseORM,
    NativeResponseStreamEventORM,
    NativeResponseToolCallORM,
    NativeResponseToolOutputORM,
    RuntimeResponseORM,
)
from app.usage.models import CostBreakdown, TokenUsage


client = TestClient(app)


def _runtime_session_factory() -> tuple[sessionmaker[Session], object]:
    sqlite_path = os.environ["FORGEGATE_EXECUTION_SQLITE_PATH"]
    engine = create_engine(f"sqlite+pysqlite:///{sqlite_path}")
    return sessionmaker(engine, autoflush=False, expire_on_commit=False), engine


def _sse_payload(raw: str, event_name: str) -> dict[str, object]:
    prefix = f"event: {event_name}\n"
    for frame in raw.split("\n\n"):
        if not frame.startswith(prefix):
            continue
        for line in frame.splitlines():
            if line.startswith("data: "):
                return json.loads(line.removeprefix("data: "))
    raise AssertionError(f"event {event_name!r} not found in stream payload")


def test_responses_sync_path_persists_native_projection_and_follow_objects() -> None:
    response = client.post(
        "/v1/responses",
        json={"input": "persist native sync truth", "metadata": {"case": "native-sync"}},
    )

    assert response.status_code == 200
    payload = response.json()
    response_id = payload["id"]

    factory, engine = _runtime_session_factory()
    try:
        with factory() as session:
            runtime_row = session.get(RuntimeResponseORM, response_id)
            native_row = session.get(NativeResponseORM, response_id)
            mapping_row = session.get(NativeResponseMappingORM, response_id)
            input_rows = (
                session.query(NativeResponseItemORM)
                .filter(
                    NativeResponseItemORM.response_id == response_id,
                    NativeResponseItemORM.phase == "input",
                )
                .order_by(NativeResponseItemORM.item_index.asc())
                .all()
            )
            output_rows = (
                session.query(NativeResponseItemORM)
                .filter(
                    NativeResponseItemORM.response_id == response_id,
                    NativeResponseItemORM.phase == "output",
                )
                .order_by(NativeResponseItemORM.item_index.asc())
                .all()
            )
            follow_rows = (
                session.query(NativeResponseFollowObjectORM)
                .filter(NativeResponseFollowObjectORM.response_id == response_id)
                .order_by(NativeResponseFollowObjectORM.row_id.asc())
                .all()
            )
            events = (
                session.query(NativeResponseEventORM)
                .filter(NativeResponseEventORM.response_id == response_id)
                .order_by(NativeResponseEventORM.sequence_no.asc())
                .all()
            )

        assert runtime_row is not None
        assert runtime_row.lifecycle_status == "completed"
        assert runtime_row.request_path == "/v1/responses"
        assert native_row is not None
        assert native_row.lifecycle_status == "completed"
        assert native_row.request_path == "/v1/responses"
        assert native_row.output_text == payload["output_text"]
        assert mapping_row is not None
        assert mapping_row.mapping_json["primary_native_object_kind"] == "response"
        object_kinds = [item["kind"] for item in mapping_row.mapping_json["objects"]]
        assert "response" in object_kinds
        assert "response_item" in object_kinds
        assert input_rows and input_rows[0].payload_json["type"] == "message"
        assert output_rows
        assert any(row.object_kind == "response" and row.object_id == response_id for row in follow_rows)
        assert [event.event_type for event in events] == ["response.created", "response.completed"]

        input_items_response = client.get(f"/v1/responses/{response_id}/input_items")
        assert input_items_response.status_code == 200
        input_items = input_items_response.json()["data"]
        assert len(input_items) == 1
        assert input_items[0]["type"] == "message"
        assert input_items[0]["content"] == [{"type": "input_text", "text": "persist native sync truth"}]

        native_projection_response = client.get(f"/v1/responses/{response_id}/native")
        assert native_projection_response.status_code == 200
        native_projection = native_projection_response.json()
        assert native_projection["object"] == "forgeframe.native_response_projection"
        assert native_projection["response_id"] == response_id
        assert native_projection["native_mapping"]["primary_native_object_kind"] == "response"
        assert any(item["relation"] == "input_item" for item in native_projection["follow_objects"])
        assert [item["event_type"] for item in native_projection["lifecycle_events"]] == [
            "response.created",
            "response.completed",
        ]
    finally:
        engine.dispose()


def test_responses_sync_failure_persists_failed_native_response_object(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        del self, payload
        raise ProviderBadRequestError("openai_api", "raw upstream bad request")

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)

    response = client.post(
        "/v1/responses",
        json={"input": "force sync failure", "model": "gpt-4.1-mini"},
    )

    assert response.status_code == 400

    factory, engine = _runtime_session_factory()
    try:
        with factory() as session:
            runtime_row = session.query(RuntimeResponseORM).order_by(RuntimeResponseORM.created_at.desc()).first()
            assert runtime_row is not None
            response_id = runtime_row.id
            native_row = session.get(NativeResponseORM, response_id)
            events = (
                session.query(NativeResponseEventORM)
                .filter(NativeResponseEventORM.response_id == response_id)
                .order_by(NativeResponseEventORM.sequence_no.asc())
                .all()
            )
            follow_rows = (
                session.query(NativeResponseFollowObjectORM)
                .filter(NativeResponseFollowObjectORM.response_id == response_id)
                .all()
            )

        assert runtime_row.lifecycle_status == "failed"
        assert runtime_row.error_json["code"] == "provider_bad_request"
        assert native_row is not None
        assert native_row.lifecycle_status == "failed"
        assert native_row.error_json["code"] == "provider_bad_request"
        assert [event.event_type for event in events] == ["response.created", "response.failed"]
        assert any(row.object_kind == "response" and row.object_id == response_id for row in follow_rows)
    finally:
        engine.dispose()


def test_responses_stream_persists_stream_events_and_completed_projection(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_stream(self, payload: dict, messages: list[dict]):
        del self, payload, messages
        yield ProviderStreamEvent(event="delta", delta="stream-")
        yield ProviderStreamEvent(
            event="done",
            finish_reason="tool_calls",
            usage=TokenUsage(input_tokens=8, output_tokens=3, total_tokens=11),
            cost=CostBreakdown(
                actual_cost=0.01,
                hypothetical_cost=0.01,
                avoided_cost=0.0,
                pricing_basis="api_metered",
            ),
            tool_calls=[{"id": "call_1", "type": "function", "function": {"name": "lookup", "arguments": "{\"q\":\"forgeframe\"}"}}],
        )

    monkeypatch.setattr(OpenAIAPIAdapter, "_stream_chat_completion", _fake_stream)

    with client.stream(
        "POST",
        "/v1/responses",
        json={"input": "stream native truth", "model": "gpt-4.1-mini", "stream": True},
    ) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    completed_payload = _sse_payload(raw, "response.completed")
    response_id = completed_payload["id"]

    factory, engine = _runtime_session_factory()
    try:
        with factory() as session:
            native_row = session.get(NativeResponseORM, response_id)
            stream_events = (
                session.query(NativeResponseStreamEventORM)
                .filter(NativeResponseStreamEventORM.response_id == response_id)
                .order_by(NativeResponseStreamEventORM.sequence_no.asc())
                .all()
            )
            output_items = (
                session.query(NativeResponseItemORM)
                .filter(
                    NativeResponseItemORM.response_id == response_id,
                    NativeResponseItemORM.phase == "output",
                )
                .order_by(NativeResponseItemORM.item_index.asc())
                .all()
            )
            tool_calls = (
                session.query(NativeResponseToolCallORM)
                .filter(
                    NativeResponseToolCallORM.response_id == response_id,
                    NativeResponseToolCallORM.phase == "output",
                )
                .order_by(NativeResponseToolCallORM.row_id.asc())
                .all()
            )

        assert native_row is not None
        assert native_row.lifecycle_status == "completed"
        assert [item.event_name for item in stream_events] == [
            "response.created",
            "response.output_text.delta",
            "response.completed",
        ]
        assert output_items
        assert any(item.payload_json["type"] == "function_call" for item in output_items)
        assert tool_calls and tool_calls[0].call_id == "call_1"
        assert completed_payload["output"][0]["type"] == "message"
        assert completed_payload["output"][0]["content"][0]["text"] == "stream-"
        assert completed_payload["output"][1:] == [
            {
                "id": "call_1",
                "type": "function_call",
                "call_id": "call_1",
                "name": "lookup",
                "arguments": "{\"q\":\"forgeframe\"}",
                "status": "completed",
            }
        ]

        native_projection_response = client.get(f"/v1/responses/{response_id}/native")
        assert native_projection_response.status_code == 200
        native_projection = native_projection_response.json()
        assert [item["event_name"] for item in native_projection["stream_events"]] == [
            "response.created",
            "response.output_text.delta",
            "response.completed",
        ]
        assert any(item["kind"] == "response_tool_call" for item in native_projection["native_mapping"]["objects"])
    finally:
        engine.dispose()


def test_responses_tool_roundtrip_persists_native_input_and_output_tool_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FORGEGATE_OPENAI_API_KEY", "test-key")

    def _fake_post(self, payload: dict) -> dict:
        del self, payload
        return {
            "model": "gpt-4.1-mini",
            "usage": {"prompt_tokens": 6, "completion_tokens": 3, "total_tokens": 9},
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "",
                        "tool_calls": [{"id": "call_out", "type": "function", "function": {"name": "lookup", "arguments": "{\"q\":\"x\"}"}}],
                    },
                    "finish_reason": "tool_calls",
                }
            ],
        }

    monkeypatch.setattr(OpenAIAPIAdapter, "_post_chat_completion", _fake_post)

    response = client.post(
        "/v1/responses",
        json={
            "model": "gpt-4.1-mini",
            "input": [
                {"type": "message", "role": "user", "content": [{"type": "input_text", "text": "use tool roundtrip"}]},
                {"type": "function_call", "call_id": "call_in", "name": "lookup", "arguments": "{\"q\":\"forgeframe\"}"},
                {"type": "function_call_output", "call_id": "call_in", "output": "lookup result"},
            ],
        },
    )

    assert response.status_code == 200
    response_id = response.json()["id"]

    factory, engine = _runtime_session_factory()
    try:
        with factory() as session:
            tool_calls = (
                session.query(NativeResponseToolCallORM)
                .filter(NativeResponseToolCallORM.response_id == response_id)
                .order_by(NativeResponseToolCallORM.phase.asc(), NativeResponseToolCallORM.call_id.asc())
                .all()
            )
            tool_outputs = (
                session.query(NativeResponseToolOutputORM)
                .filter(NativeResponseToolOutputORM.response_id == response_id)
                .order_by(NativeResponseToolOutputORM.output_index.asc())
                .all()
            )

        assert [(row.phase, row.call_id) for row in tool_calls] == [("input", "call_in"), ("output", "call_out")]
        assert len(tool_outputs) == 1
        assert tool_outputs[0].call_id == "call_in"
        assert tool_outputs[0].payload_json["output"] == "lookup result"
        assert response.json()["output"] == [
            {
                "id": "call_out",
                "type": "function_call",
                "call_id": "call_out",
                "name": "lookup",
                "arguments": "{\"q\":\"x\"}",
                "status": "completed",
            }
        ]

        native_projection_response = client.get(f"/v1/responses/{response_id}/native")
        assert native_projection_response.status_code == 200
        native_projection = native_projection_response.json()
        assert [item["call_id"] for item in native_projection["tool_calls"]] == ["call_in", "call_out"]
        assert native_projection["tool_outputs"][0]["call_id"] == "call_in"
        assert any(item["kind"] == "response_tool_output" for item in native_projection["native_mapping"]["objects"])
    finally:
        engine.dispose()
