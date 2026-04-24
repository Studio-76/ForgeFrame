"""OpenAI compatibility corpus and signoff truth for provider/operator surfaces."""

from __future__ import annotations

from typing import Any

from app.control_plane import (
    OpenAICompatibilitySignoffRecord,
    OpenAICompatibilitySummaryRecord,
)
from app.execution.dependencies import get_execution_session_factory
from app.storage.runtime_responses_repository import (
    NativeResponseItemORM,
    NativeResponseStreamEventORM,
    NativeResponseToolCallORM,
    RuntimeResponseORM,
)
from app.storage.runtime_files_repository import RuntimeFileORM


_OPENAI_CORPUS_LABELS: dict[str, str] = {
    "chat_simple": "Chat simple",
    "chat_multimodal": "Chat multimodal",
    "responses_simple": "Responses simple",
    "responses_input_items": "Responses input_items",
    "streaming_chat": "Streaming chat",
    "streaming_responses": "Streaming responses",
    "tool_calling": "Tool calling",
    "structured_output": "Structured output",
    "error_semantics": "Error semantics",
    "unsupported_partial_fields": "Unsupported/partial fields",
    "model_listing": "Model listing",
    "files": "Files",
    "embeddings": "Embeddings",
}


class ControlPlaneOpenAICompatibilityDomainMixin:
    @staticmethod
    def _signoff_row(
        corpus_class: str,
        *,
        status: str,
        route: str | None = None,
        provider_axis: str | None = None,
        live_evidence_required: bool = False,
        deviation_reason: str | None = None,
        evidence_source: str,
        last_verified_at: str | None = None,
        sample_request_id: str | None = None,
        raw_diff_summary: str | None = None,
        notes: str | None = None,
    ) -> OpenAICompatibilitySignoffRecord:
        return OpenAICompatibilitySignoffRecord(
            corpus_class=corpus_class,  # type: ignore[arg-type]
            label=_OPENAI_CORPUS_LABELS[corpus_class],
            status=status,  # type: ignore[arg-type]
            route=route,
            provider_axis=provider_axis,
            live_evidence_required=live_evidence_required,
            deviation_reason=deviation_reason,
            evidence_source=evidence_source,
            last_verified_at=last_verified_at,
            sample_request_id=sample_request_id,
            raw_diff_summary=raw_diff_summary,
            notes=notes,
        )

    def _openai_compat_usage_events(self, tenant_id: str | None = None) -> list[Any]:
        return sorted(
            self._analytics.list_usage_events(tenant_id=tenant_id),
            key=lambda event: str(getattr(event, "created_at", "")),
        )

    def _openai_compat_error_events(self, tenant_id: str | None = None) -> list[Any]:
        return sorted(
            self._analytics.list_error_events(tenant_id=tenant_id),
            key=lambda event: str(getattr(event, "created_at", "")),
        )

    @staticmethod
    def _latest_route_event(
        events: list[Any],
        *,
        route: str,
        stream_mode: str | None = None,
        require_tool_calls: bool = False,
    ) -> Any | None:
        for event in reversed(events):
            if str(getattr(event, "route", "") or "") != route:
                continue
            if stream_mode is not None and str(getattr(event, "stream_mode", "") or "") != stream_mode:
                continue
            if require_tool_calls and int(getattr(event, "tool_call_count", 0) or 0) <= 0:
                continue
            return event
        return None

    @staticmethod
    def _runtime_company_id_for_signoff(tenant_id: str | None, default_tenant_id: str) -> str:
        return str((tenant_id or default_tenant_id or "").strip() or default_tenant_id)

    @staticmethod
    def _structured_input_payload(items: list[dict[str, Any]]) -> bool:
        if len(items) > 1:
            return True
        for item in items:
            item_type = str(item.get("type") or "")
            if item_type in {"function_call", "function_call_output"}:
                return True
            content = item.get("content")
            if isinstance(content, list) and len(content) > 1:
                return True
            for block in content or []:
                if str(block.get("type") or "") == "input_image":
                    return True
        return False

    def _recent_runtime_responses(
        self,
        *,
        company_id: str,
        stream: bool | None = None,
        completed_only: bool = True,
        limit: int = 50,
    ) -> list[RuntimeResponseORM]:
        session_factory = get_execution_session_factory()
        with session_factory() as session:
            query = session.query(RuntimeResponseORM).filter(
                RuntimeResponseORM.company_id == company_id,
                RuntimeResponseORM.request_path == "/v1/responses",
            )
            if stream is not None:
                query = query.filter(RuntimeResponseORM.stream == stream)
            if completed_only:
                query = query.filter(RuntimeResponseORM.lifecycle_status == "completed")
            return (
                query.order_by(RuntimeResponseORM.created_at.desc())
                .limit(limit)
                .all()
            )

    def _latest_response_with_structured_input(
        self,
        *,
        company_id: str,
    ) -> RuntimeResponseORM | None:
        for record in self._recent_runtime_responses(company_id=company_id, stream=None):
            if self._structured_input_payload(list(record.input_items or [])):
                return record
        return None

    def _latest_response_with_tool_calls(
        self,
        *,
        company_id: str,
    ) -> RuntimeResponseORM | None:
        session_factory = get_execution_session_factory()
        with session_factory() as session:
            rows = (
                session.query(NativeResponseToolCallORM.response_id)
                .filter(NativeResponseToolCallORM.company_id == company_id)
                .order_by(NativeResponseToolCallORM.updated_at.desc())
                .all()
            )
            response_ids = [str(item[0]) for item in rows if item and item[0]]
        recent = {record.id: record for record in self._recent_runtime_responses(company_id=company_id, stream=None)}
        for response_id in response_ids:
            if response_id in recent:
                return recent[response_id]
        return None

    def _latest_streaming_response_with_events(
        self,
        *,
        company_id: str,
    ) -> RuntimeResponseORM | None:
        session_factory = get_execution_session_factory()
        with session_factory() as session:
            rows = (
                session.query(NativeResponseStreamEventORM.response_id)
                .filter(NativeResponseStreamEventORM.company_id == company_id)
                .order_by(NativeResponseStreamEventORM.created_at.desc())
                .all()
            )
            response_ids = [str(item[0]) for item in rows if item and item[0]]
        recent = {
            record.id: record
            for record in self._recent_runtime_responses(company_id=company_id, stream=True)
        }
        for response_id in response_ids:
            if response_id in recent:
                return recent[response_id]
        return None

    def _latest_response_with_native_items(
        self,
        *,
        company_id: str,
    ) -> RuntimeResponseORM | None:
        session_factory = get_execution_session_factory()
        with session_factory() as session:
            rows = (
                session.query(NativeResponseItemORM.response_id)
                .filter(
                    NativeResponseItemORM.company_id == company_id,
                    NativeResponseItemORM.phase == "input",
                )
                .order_by(NativeResponseItemORM.created_at.desc())
                .all()
            )
            response_ids = [str(item[0]) for item in rows if item and item[0]]
        recent = {record.id: record for record in self._recent_runtime_responses(company_id=company_id, stream=None)}
        for response_id in response_ids:
            if response_id in recent:
                return recent[response_id]
        return None

    def _latest_structured_output_response(
        self,
        *,
        company_id: str,
    ) -> RuntimeResponseORM | None:
        for record in self._recent_runtime_responses(company_id=company_id, stream=None):
            response_format = dict(record.request_controls or {}).get("response_format")
            if isinstance(response_format, dict) and response_format:
                return record
        return None

    def _latest_runtime_file(
        self,
        *,
        company_id: str,
    ) -> RuntimeFileORM | None:
        session_factory = get_execution_session_factory()
        with session_factory() as session:
            return (
                session.query(RuntimeFileORM)
                .filter(RuntimeFileORM.company_id == company_id)
                .order_by(RuntimeFileORM.created_at.desc())
                .first()
            )

    @staticmethod
    def _signoff_summary(rows: list[OpenAICompatibilitySignoffRecord]) -> OpenAICompatibilitySummaryRecord:
        summary = OpenAICompatibilitySummaryRecord(total_checks=len(rows))
        for row in rows:
            if row.status == "supported":
                summary.supported += 1
            elif row.status == "partial":
                summary.partial += 1
            elif row.status == "unsupported":
                summary.unsupported += 1
            elif row.status == "skipped":
                summary.skipped += 1
            elif row.status == "blocked-by-live-evidence":
                summary.blocked_by_live_evidence += 1
        summary.signoff_claimable = (
            summary.total_checks > 0
            and summary.partial == 0
            and summary.unsupported == 0
            and summary.blocked_by_live_evidence == 0
        )
        if summary.signoff_claimable:
            summary.overall_status = "supported"
        elif summary.supported > 0 or summary.partial > 0 or summary.blocked_by_live_evidence > 0:
            summary.overall_status = "partial"
        else:
            summary.overall_status = "unsupported"
        return summary

    def openai_compatibility_signoff(self, tenant_id: str | None = None) -> dict[str, object]:
        effective_tenant_id = self._effective_truth_projection_tenant_id(tenant_id)
        company_id = self._runtime_company_id_for_signoff(effective_tenant_id, self._default_tenant_id)
        usage_events = self._openai_compat_usage_events(effective_tenant_id)
        error_events = self._openai_compat_error_events(effective_tenant_id)
        truth_axes = {item.provider.provider: item for item in self.provider_truth_axes(tenant_id=effective_tenant_id)}

        chat_non_stream = self._latest_route_event(
            usage_events,
            route="/v1/chat/completions",
            stream_mode="non_stream",
        )
        chat_stream = self._latest_route_event(
            usage_events,
            route="/v1/chat/completions",
            stream_mode="stream",
        )
        tool_usage = next(
            (
                event
                for event in reversed(usage_events)
                if int(getattr(event, "tool_call_count", 0) or 0) > 0
                and str(getattr(event, "route", "") or "") in {"/v1/chat/completions", "/v1/responses"}
            ),
            None,
        )
        typed_error = next(
            (
                event
                for event in reversed(error_events)
                if str(getattr(event, "route", "") or "") in {"/v1/chat/completions", "/v1/responses"}
                and str(getattr(event, "error_type", "") or "").strip()
            ),
            None,
        )
        latest_response = next(iter(self._recent_runtime_responses(company_id=company_id, stream=False)), None)
        structured_response = self._latest_response_with_structured_input(company_id=company_id)
        structured_output_response = self._latest_structured_output_response(company_id=company_id)
        tool_response = self._latest_response_with_tool_calls(company_id=company_id)
        streaming_response = self._latest_streaming_response_with_events(company_id=company_id)
        native_items_response = self._latest_response_with_native_items(company_id=company_id)
        runtime_file = self._latest_runtime_file(company_id=company_id)
        embeddings_usage = self._latest_route_event(
            usage_events,
            route="/v1/embeddings",
            stream_mode="non_stream",
        )

        any_vision_provider = any(
            bool(axis.runtime.capabilities.get("vision")) or str(axis.runtime.capabilities.get("vision_level", "")) not in {"", "none"}
            for axis in truth_axes.values()
        )

        rows = [
            self._signoff_row(
                "chat_simple",
                status="supported" if chat_non_stream is not None else "blocked-by-live-evidence",
                route="/v1/chat/completions",
                provider_axis="openai_compatible_clients",
                live_evidence_required=True,
                deviation_reason=(
                    None
                    if chat_non_stream is not None
                    else "The chat-compatible runtime surface exists, but no recorded non-stream runtime evidence exists for this tenant."
                ),
                evidence_source="runtime_usage" if chat_non_stream is not None else "backend/tests/test_runtime_core.py",
                last_verified_at=getattr(chat_non_stream, "created_at", None),
                sample_request_id=getattr(chat_non_stream, "request_id", None),
                raw_diff_summary=None if chat_non_stream is not None else "Runtime proof missing for chat simple.",
            ),
            self._signoff_row(
                "chat_multimodal",
                status="blocked-by-live-evidence" if any_vision_provider else "unsupported",
                route="/v1/chat/completions",
                provider_axis="openai_compatible_clients",
                live_evidence_required=True,
                deviation_reason=(
                    "Vision-capable provider claims exist, but no class-specific multimodal chat evidence is recorded."
                    if any_vision_provider
                    else "No verified multimodal chat surface is wired on the public OpenAI-compatible path."
                ),
                evidence_source="backend/tests/test_runtime_core.py" if any_vision_provider else "repo_gap",
                raw_diff_summary=(
                    "Multimodal provider capability is present in parts of the repo, but no signed-off public chat-multimodal runtime proof exists."
                ),
            ),
            self._signoff_row(
                "responses_simple",
                status="partial" if latest_response is not None else "blocked-by-live-evidence",
                route="/v1/responses",
                provider_axis="openai_compatible_clients",
                live_evidence_required=True,
                deviation_reason=(
                    "Native response persistence exists, but request dispatch still translates native input into chat messages before provider execution."
                    if latest_response is not None
                    else "No completed /v1/responses runtime evidence is recorded for this tenant."
                ),
                evidence_source=(
                    "runtime_response_projection+backend/tests/test_native_responses_runtime_contract.py"
                    if latest_response is not None
                    else "backend/tests/test_native_responses_runtime_contract.py"
                ),
                last_verified_at=getattr(latest_response, "updated_at", None).isoformat() if latest_response is not None and getattr(latest_response, "updated_at", None) is not None else None,
                raw_diff_summary=(
                    "The durable object model is native, but the provider-execution path remains a compatibility translation layer."
                ),
            ),
            self._signoff_row(
                "responses_input_items",
                status="partial" if structured_response is not None and native_items_response is not None else "blocked-by-live-evidence",
                route="/v1/responses",
                provider_axis="openai_compatible_clients",
                live_evidence_required=True,
                deviation_reason=(
                    "Structured input_items are persisted natively, but execution still routes through chat-message translation rather than a provider-native responses contract."
                    if structured_response is not None and native_items_response is not None
                    else "No recorded structured input_items runtime evidence is stored yet."
                ),
                evidence_source=(
                    "runtime_response_projection+backend/tests/test_native_responses_runtime_contract.py"
                    if structured_response is not None and native_items_response is not None
                    else "backend/tests/test_native_responses_runtime_contract.py"
                ),
                last_verified_at=getattr(structured_response, "updated_at", None).isoformat() if structured_response is not None and getattr(structured_response, "updated_at", None) is not None else None,
                raw_diff_summary="Input-items truth is durable, but provider execution remains chat-translated.",
            ),
            self._signoff_row(
                "streaming_chat",
                status="supported" if chat_stream is not None else "blocked-by-live-evidence",
                route="/v1/chat/completions",
                provider_axis="openai_compatible_clients",
                live_evidence_required=True,
                deviation_reason=(
                    None
                    if chat_stream is not None
                    else "The streaming chat surface exists, but no recorded stream runtime evidence exists for this tenant."
                ),
                evidence_source="runtime_usage" if chat_stream is not None else "backend/tests/test_runtime_core.py",
                last_verified_at=getattr(chat_stream, "created_at", None),
                sample_request_id=getattr(chat_stream, "request_id", None),
                raw_diff_summary=None if chat_stream is not None else "Streaming chat proof missing.",
            ),
            self._signoff_row(
                "streaming_responses",
                status="partial" if streaming_response is not None else "blocked-by-live-evidence",
                route="/v1/responses",
                provider_axis="openai_compatible_clients",
                live_evidence_required=True,
                deviation_reason=(
                    "Streaming response events are persisted natively, but the provider-execution path still terminates in chat-compatible event translation."
                    if streaming_response is not None
                    else "No recorded streaming /v1/responses runtime evidence is stored yet."
                ),
                evidence_source=(
                    "runtime_stream_projection+backend/tests/test_native_responses_runtime_contract.py"
                    if streaming_response is not None
                    else "backend/tests/test_native_responses_runtime_contract.py"
                ),
                last_verified_at=getattr(streaming_response, "updated_at", None).isoformat() if streaming_response is not None and getattr(streaming_response, "updated_at", None) is not None else None,
                raw_diff_summary="SSE lifecycle truth is durable, but the upstream adapter contract is still chat-oriented.",
            ),
            self._signoff_row(
                "tool_calling",
                status="partial" if tool_response is not None or tool_usage is not None else "blocked-by-live-evidence",
                route="/v1/responses",
                provider_axis="openai_compatible_clients",
                live_evidence_required=True,
                deviation_reason=(
                    "Tool calls and tool outputs are persisted natively, but they are still emitted through chat/tool compatibility translation rather than a fully provider-native responses loop."
                    if tool_response is not None or tool_usage is not None
                    else "No recorded runtime tool-calling evidence exists for the public compatibility surface."
                ),
                evidence_source=(
                    "runtime_tool_projection+backend/tests/test_native_responses_runtime_contract.py"
                    if tool_response is not None or tool_usage is not None
                    else "backend/tests/test_native_responses_runtime_contract.py"
                ),
                last_verified_at=(
                    getattr(tool_usage, "created_at", None)
                    or (
                        getattr(tool_response, "updated_at", None).isoformat()
                        if tool_response is not None and getattr(tool_response, "updated_at", None) is not None
                        else None
                    )
                ),
                sample_request_id=getattr(tool_usage, "request_id", None),
                raw_diff_summary="Tool roundtrips are durable and typed, but not yet provider-native end to end.",
            ),
            self._signoff_row(
                "structured_output",
                status="supported" if structured_output_response is not None else "blocked-by-live-evidence",
                route="/v1/responses",
                provider_axis="openai_compatible_clients",
                live_evidence_required=True,
                deviation_reason=(
                    None
                    if structured_output_response is not None
                    else "Structured-output controls are wired on `/v1/responses`, but no completed runtime evidence is recorded for this tenant yet."
                ),
                evidence_source=(
                    "runtime_response_projection+backend/tests/test_runtime_core.py"
                    if structured_output_response is not None
                    else "backend/tests/test_runtime_core.py"
                ),
                last_verified_at=getattr(structured_output_response, "updated_at", None).isoformat() if structured_output_response is not None and getattr(structured_output_response, "updated_at", None) is not None else None,
                raw_diff_summary=(
                    None
                    if structured_output_response is not None
                    else "Structured-output runtime proof is missing for the current tenant."
                ),
            ),
            self._signoff_row(
                "error_semantics",
                status="supported" if typed_error is not None else "partial",
                route="/v1/responses",
                provider_axis="openai_compatible_clients",
                deviation_reason=(
                    None
                    if typed_error is not None
                    else "Typed public error mapping exists in code and tests, but no recent runtime error sample is recorded for this tenant."
                ),
                evidence_source=(
                    "runtime_error_event+backend/tests/test_external_openai_path.py"
                    if typed_error is not None
                    else "backend/tests/test_external_openai_path.py"
                ),
                last_verified_at=getattr(typed_error, "created_at", None),
                sample_request_id=getattr(typed_error, "request_id", None),
                raw_diff_summary=(
                    None
                    if typed_error is not None
                    else "Contract tests prove sanitized typed errors, but no fresh runtime failure sample is present."
                ),
            ),
            self._signoff_row(
                "unsupported_partial_fields",
                status="supported",
                route="/v1/responses",
                provider_axis="openai_compatible_clients",
                deviation_reason=None,
                evidence_source="backend/tests/test_runtime_core.py",
                raw_diff_summary="Unsupported fields are rejected explicitly instead of being silently ignored.",
                notes="This row measures negative-contract honesty, not positive feature breadth.",
            ),
            self._signoff_row(
                "model_listing",
                status="partial",
                route="/v1/models",
                provider_axis="openai_compatible_clients",
                deviation_reason="Public model inventory exists and is tested, but no dedicated signoff runner currently records fresh `/v1/models` evidence into operator history.",
                evidence_source="backend/tests/test_runtime_core.py+scripts/compose-client-compat-signoff.sh",
                raw_diff_summary="The sanitized model list is implemented, but operator evidence for this slice is not yet first-class.",
            ),
            self._signoff_row(
                "files",
                status="partial" if runtime_file is not None else "blocked-by-live-evidence",
                route="/v1/files",
                provider_axis="openai_compatible_clients",
                live_evidence_required=True,
                deviation_reason=(
                    "Public file upload/list/retrieve/delete/content APIs are shipped, but cross-surface parity beyond the current compatibility slice remains partial."
                    if runtime_file is not None
                    else "The public files surface is wired, but no uploaded runtime file evidence is recorded for this tenant yet."
                ),
                evidence_source=(
                    "runtime_files_projection+backend/tests/test_runtime_core.py"
                    if runtime_file is not None
                    else "backend/tests/test_runtime_core.py"
                ),
                last_verified_at=getattr(runtime_file, "updated_at", None).isoformat() if runtime_file is not None and getattr(runtime_file, "updated_at", None) is not None else None,
                raw_diff_summary=(
                    "Core file APIs exist, but broader file-purpose parity remains intentionally partial."
                    if runtime_file is not None
                    else "No runtime file evidence is present yet."
                ),
            ),
            self._signoff_row(
                "embeddings",
                status="supported" if embeddings_usage is not None else "blocked-by-live-evidence",
                route="/v1/embeddings",
                provider_axis="openai_compatible_clients",
                live_evidence_required=True,
                deviation_reason=(
                    None
                    if embeddings_usage is not None
                    else "The public embeddings surface is wired, but no recorded embeddings runtime usage exists for this tenant yet."
                ),
                evidence_source="runtime_usage" if embeddings_usage is not None else "backend/tests/test_runtime_core.py",
                last_verified_at=getattr(embeddings_usage, "created_at", None),
                sample_request_id=getattr(embeddings_usage, "request_id", None),
                raw_diff_summary=(
                    None
                    if embeddings_usage is not None
                    else "Embeddings runtime proof is missing for the current tenant."
                ),
            ),
        ]

        summary = self._signoff_summary(rows)
        return {
            "summary": summary.model_dump(),
            "rows": [row.model_dump() for row in rows],
            "notes": [
                "supported means this exact corpus slice has concrete runtime or operator evidence and no known contract deviation inside the slice.",
                "partial means the slice exists but still carries a known contract deviation.",
                "blocked-by-live-evidence means repo or test truth exists, but no truthful runtime evidence is recorded for this tenant yet.",
            ],
        }
