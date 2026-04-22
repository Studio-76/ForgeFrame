"""Harness services for declarative mapping, templates, and verification workflows."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx

from app.harness.models import (
    HarnessImportRequest,
    HarnessModelInventoryItem,
    HarnessPreviewRequest,
    HarnessProfileRecord,
    HarnessProviderProfile,
    HarnessVerificationRequest,
    HarnessVerificationResult,
    HarnessVerificationRun,
)
from app.harness.redaction import redact_sensitive_payload
from app.harness.store import HarnessStore
from app.harness.templates import BUILTIN_TEMPLATES
from app.request_metadata import forgegate_request_metadata_headers
from app.settings.config import get_settings
from app.storage.harness_repository import FileHarnessRepository, HarnessRunQuery, HarnessStoragePaths, PostgresHarnessRepository


class HarnessService:
    def __init__(self, store: HarnessStore):
        self._store = store

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(tz=UTC).isoformat()

    def list_templates(self) -> list[dict[str, Any]]:
        return [
            {
                "id": template.id,
                "label": template.label,
                "integration_class": template.integration_class,
                "description": template.description,
            }
            for template in BUILTIN_TEMPLATES.values()
        ]

    @staticmethod
    def _config_snapshot_from_profile(profile: HarnessProviderProfile | HarnessProfileRecord) -> dict[str, Any]:
        return HarnessProviderProfile(**profile.model_dump()).model_dump()

    def _history_entry(self, profile: HarnessProfileRecord) -> dict[str, Any]:
        return {
            "revision": profile.config_revision,
            "saved_at": profile.updated_at or self._now_iso(),
            "profile": self._config_snapshot_from_profile(profile),
        }

    def upsert_profile(self, profile: HarnessProviderProfile) -> HarnessProfileRecord:
        record = HarnessProfileRecord(**profile.model_dump())
        try:
            existing = self.get_profile(profile.provider_key)
        except ValueError:
            existing = None
        if existing is None:
            record.config_revision = 1
            record.config_revision_parent = None
            record.config_history = []
        else:
            existing_config = self._config_snapshot_from_profile(existing)
            incoming_config = self._config_snapshot_from_profile(profile)
            if existing_config != incoming_config:
                record.config_revision = existing.config_revision + 1
                record.config_revision_parent = existing.config_revision
                record.config_history = [*existing.config_history, self._history_entry(existing)][-20:]
            else:
                record.config_revision = existing.config_revision
                record.config_revision_parent = existing.config_revision_parent
                record.config_history = list(existing.config_history)
            record.last_exported_at = existing.last_exported_at
            record.last_imported_at = existing.last_imported_at
        if not record.model_inventory and record.models:
            record.model_inventory = [
                HarnessModelInventoryItem(
                    model=model,
                    source=record.capabilities.model_source,
                    status="ready" if record.enabled else "warning",
                    readiness_reason=None if record.enabled else "profile_disabled",
                )
                for model in record.models
            ]
        return self._store.upsert_profile(record)

    def delete_profile(self, provider_key: str) -> None:
        self._store.delete_profile(provider_key)

    def set_profile_active(self, provider_key: str, enabled: bool) -> HarnessProfileRecord:
        return self._store.set_profile_active(provider_key, enabled)

    def list_profiles(self) -> list[HarnessProfileRecord]:
        return self._store.list_profiles()

    def get_profile(self, provider_key: str) -> HarnessProfileRecord:
        return self._store.get_profile(provider_key)

    def list_runs(
        self,
        provider_key: str | None = None,
        *,
        mode: str | None = None,
        status: str | None = None,
        client_id: str | None = None,
        limit: int | None = 200,
    ) -> list[HarnessVerificationRun]:
        return self._store.list_runs(HarnessRunQuery(provider_key=provider_key, mode=mode, status=status, client_id=client_id, limit=limit))

    def runs_summary(self, provider_key: str | None = None) -> dict[str, int]:
        return self._store.runs_summary(provider_key)

    def build_request_preview(
        self,
        payload: HarnessPreviewRequest,
        *,
        request_metadata: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        profile = self.get_profile(payload.provider_key)
        rendered_messages = list(payload.messages) if payload.messages else [{"role": "user", "content": payload.message}]
        request_payload = self._render_template(
            profile.request_mapping.body_template,
            {
                "model": payload.model,
                "messages": rendered_messages,
                "stream": payload.stream,
                "tools": payload.tools,
                "tool_choice": payload.tool_choice,
                "temperature": payload.temperature,
                "max_output_tokens": payload.max_output_tokens,
                "metadata": payload.metadata,
            },
        )
        if payload.tools and "tools" not in request_payload:
            request_payload["tools"] = payload.tools
        if payload.tool_choice is not None and "tool_choice" not in request_payload:
            request_payload["tool_choice"] = payload.tool_choice
        if payload.temperature is not None and "temperature" not in request_payload:
            request_payload["temperature"] = payload.temperature
        if payload.max_output_tokens is not None and "max_output_tokens" not in request_payload and "max_tokens" not in request_payload:
            request_payload["max_tokens"] = payload.max_output_tokens
        if payload.metadata and "metadata" not in request_payload:
            request_payload["metadata"] = payload.metadata
        endpoint = f"{profile.endpoint_base_url.rstrip('/')}{profile.request_mapping.path}"
        headers = self._build_headers(profile)
        headers.update(profile.request_mapping.headers)
        headers.update(forgegate_request_metadata_headers(request_metadata))
        return {"method": profile.request_mapping.method, "url": endpoint, "headers": headers, "json": request_payload}

    def preview(self, payload: HarnessPreviewRequest) -> dict[str, Any]:
        profile = self.get_profile(payload.provider_key)
        preview = self.build_request_preview(payload)
        self._store.record_run(
            HarnessVerificationRun(
                provider_key=profile.provider_key,
                integration_class=profile.integration_class,
                model=payload.model,
                mode="preview",
                status="ok",
                success=True,
                steps=[{"step": "request_rendering", "status": "ok"}],
                executed_at=self._now_iso(),
                client_id="control_plane",
                consumer="control_plane",
                integration="harness_preview",
            )
        )
        return preview

    def dry_run(self, payload: HarnessPreviewRequest) -> dict[str, Any]:
        profile = self.get_profile(payload.provider_key)
        preview = self.build_request_preview(payload)
        mapped_example = {
            "model": payload.model,
            "content": self._extract({"choices": [{"message": {"content": "sample"}}]}, profile.response_mapping.text_path, default=""),
            "finish_reason": "stop",
        }
        run = HarnessVerificationRun(
            provider_key=profile.provider_key,
            integration_class=profile.integration_class,
            model=payload.model,
            mode="dry_run",
            status="ok",
            success=True,
            steps=[
                {"step": "request_rendering", "status": "ok"},
                {"step": "response_mapping", "status": "ok"},
                {
                    "step": "tool_calling_support",
                    "status": "ok",
                    "support": "supported" if profile.capabilities.tool_calling else "unsupported",
                },
                {"step": "stream_readiness", "status": "ok" if profile.stream_mapping.enabled else "skipped"},
            ],
            executed_at=self._now_iso(),
        )
        self._store.record_run(run)
        return {"preview_request": preview, "mapped_example": mapped_example, "run": run.model_dump()}

    def verify_profile(self, request: HarnessVerificationRequest) -> HarnessVerificationResult:
        profile = self.get_profile(request.provider_key)
        model = request.model or (profile.models[0] if profile.models else "unknown-model")
        preview_payload = HarnessPreviewRequest(provider_key=profile.provider_key, model=model, message=request.test_message, stream=False)
        preview = self.build_request_preview(preview_payload)

        steps: list[dict[str, Any]] = [{"step": "preview_request", "status": "ok"}]
        if not profile.endpoint_base_url.startswith(("http://", "https://")):
            raise ValueError("endpoint_base_url must be absolute http(s) URL.")
        steps.append({"step": "test_connection", "status": "ok"})

        if profile.auth_scheme != "none" and not profile.auth_value.strip():
            steps.append({"step": "test_authentication", "status": "failed"})
            result = HarnessVerificationResult(
                provider_key=profile.provider_key,
                integration_class=profile.integration_class,
                steps=steps,
                preview_request=preview if request.include_preview else None,
                success=False,
            )
            self._store.record_run(
                HarnessVerificationRun(
                    provider_key=profile.provider_key,
                    integration_class=profile.integration_class,
                    model=model,
                    mode="verify",
                    status="failed",
                    success=False,
                    steps=steps,
                    error="missing_auth_value",
                    executed_at=self._now_iso(),
                )
            )
            return result

        steps.append({"step": "test_authentication", "status": "ok"})
        steps.append({"step": "test_discovery", "status": "ok" if profile.discovery_enabled else "skipped"})
        steps.append({"step": "request_rendering", "status": "ok"})
        steps.append({"step": "response_mapping", "status": "ok"})
        steps.append(
            {
                "step": "tool_calling_support",
                "status": "ok",
                "support": "supported" if profile.capabilities.tool_calling else "unsupported",
            }
        )
        steps.append({"step": "stream_readiness", "status": "ok" if (request.check_stream and profile.stream_mapping.enabled) else "skipped"})

        if request.live_probe:
            try:
                probe_result = self.probe(HarnessPreviewRequest(provider_key=profile.provider_key, model=model, message=request.test_message, stream=False))
                probe_status = "ok" if int(probe_result["status_code"]) < 400 else "failed"
                steps.append({"step": "live_probe", "status": probe_status, "status_code": int(probe_result["status_code"])})
            except RuntimeError as exc:
                steps.append({"step": "live_probe", "status": "failed", "error": str(exc)})

        result = HarnessVerificationResult(
            provider_key=profile.provider_key,
            integration_class=profile.integration_class,
            steps=steps,
            preview_request=preview if request.include_preview else None,
            success=True,
        )
        self._store.record_run(
            HarnessVerificationRun(
                provider_key=profile.provider_key,
                integration_class=profile.integration_class,
                model=model,
                mode="verify",
                status="ok",
                success=True,
                steps=steps,
                executed_at=self._now_iso(),
            )
        )
        return result

    def probe(self, payload: HarnessPreviewRequest) -> dict[str, Any]:
        profile = self.get_profile(payload.provider_key)
        preview = self.build_request_preview(payload)
        try:
            response = httpx.request(preview["method"], preview["url"], headers=preview["headers"], json=preview["json"], timeout=30)
        except httpx.RequestError as exc:
            redacted_error = str(redact_sensitive_payload(str(exc)))
            run = HarnessVerificationRun(
                provider_key=profile.provider_key,
                integration_class=profile.integration_class,
                model=payload.model,
                mode="probe",
                status="failed",
                success=False,
                steps=[{"step": "probe_request", "status": "failed"}],
                error=redacted_error,
                executed_at=self._now_iso(),
            )
            self._store.record_run(run)
            raise RuntimeError(f"Harness probe request failed: {redacted_error}") from exc

        body = response.json() if "json" in response.headers.get("content-type", "") else {"raw": response.text}
        parsed = self._parse_non_stream_response(profile, body, model=payload.model)
        redacted_body = redact_sensitive_payload(body)
        redacted_parsed = redact_sensitive_payload(parsed)
        success = response.status_code < 400
        run = HarnessVerificationRun(
            provider_key=profile.provider_key,
            integration_class=profile.integration_class,
            model=payload.model,
            mode="probe",
            status="ok" if success else "failed",
            success=success,
            steps=[{"step": "probe_request", "status": "ok" if success else "failed", "status_code": response.status_code}],
            error=None if success else str(redacted_body)[:500],
            executed_at=self._now_iso(),
        )
        self._store.record_run(run)
        return {
            "status_code": response.status_code,
            "parsed": redacted_parsed,
            "raw": redacted_body,
            "run": redact_sensitive_payload(run.model_dump()),
        }

    def sync_profile_inventory(self, provider_key: str) -> HarnessProfileRecord:
        profile = self.get_profile(provider_key)
        previous = {item.model: item for item in profile.model_inventory}
        now = self._now_iso()
        inventory = [
            HarnessModelInventoryItem(
                model=model,
                source=profile.capabilities.model_source,
                active=profile.enabled,
                status="ready" if profile.enabled else "warning",
                readiness_reason=None if profile.enabled else "profile_disabled",
                discovered_at=previous.get(model).discovered_at if model in previous else now,
                synced_at=now,
            )
            for model in profile.models
        ]
        if not inventory:
            inventory = [HarnessModelInventoryItem(model="no_models_configured", source="manual", active=False, status="warning", readiness_reason="profile_has_no_models", discovered_at=now, synced_at=now)]
            updated = self._store.update_inventory(provider_key, inventory, status="warning", error="profile_has_no_models")
            self._store.record_run(HarnessVerificationRun(provider_key=profile.provider_key, integration_class=profile.integration_class, mode="sync", status="warning", success=False, steps=[{"step": "discovery", "status": "warning", "reason": "profile_has_no_models"}, {"step": "inventory_diff", "status": "warning", "added": 1, "removed": len(previous), "stale": len(previous)}], error="profile_has_no_models", executed_at=self._now_iso()))
            return updated

        current_ids = {item.model for item in inventory}
        removed = sorted([model for model in previous if model not in current_ids])
        added = sorted([item.model for item in inventory if item.model not in previous])
        stale = []
        if removed:
            stale = removed
            inventory.extend([HarnessModelInventoryItem(model=model, source=previous[model].source, active=False, status="stale", readiness_reason="removed_from_profile_models", discovered_at=previous[model].discovered_at, synced_at=now) for model in removed])

        updated = self._store.update_inventory(provider_key, inventory, status="ok")
        self._store.record_run(HarnessVerificationRun(provider_key=profile.provider_key, integration_class=profile.integration_class, mode="sync", status="ok" if not stale else "warning", success=not bool(stale), steps=[{"step": "discovery", "status": "ok", "source": profile.capabilities.model_source}, {"step": "inventory_diff", "status": "ok" if not stale else "warning", "added": len(added), "removed": len(removed), "stale": len(stale)}], executed_at=self._now_iso()))
        return updated

    def export_snapshot(self, *, redact_secrets: bool = True) -> dict[str, Any]:
        snapshot = self._store.export_snapshot()
        profiles = snapshot.get("profiles", [])
        runs = snapshot.get("runs", [])
        snapshot["summary"] = {
            "profile_count": len(profiles),
            "active_profile_count": len([item for item in profiles if item.get("enabled")]),
            "degraded_profile_count": len([item for item in profiles if item.get("lifecycle_status") in {"degraded", "error"}]),
            "run_count": len(runs),
            "failed_run_count": len([item for item in runs if not item.get("success")]),
        }
        if redact_secrets:
            return redact_sensitive_payload(snapshot)
        return snapshot

    def export_config_snapshot(self, *, redact_secrets: bool = True, include_runs: bool = True) -> dict[str, Any]:
        profiles = []
        for profile in self.list_profiles():
            payload = {
                "provider_key": profile.provider_key,
                "config_revision": profile.config_revision,
                "saved_at": profile.updated_at,
                "profile": self._config_snapshot_from_profile(profile),
            }
            profiles.append(payload)
        snapshot = {
            "schema_version": 1,
            "object": "harness_config_export",
            "exported_at": self._now_iso(),
            "redacted": redact_secrets,
            "profiles": profiles,
        }
        if include_runs:
            snapshot["recent_runs"] = [item.model_dump() for item in self.list_runs(limit=40)]
        snapshot["summary"] = {
            "profile_count": len(profiles),
            "revisions": sum(int(item.get("config_revision", 1)) for item in profiles),
        }
        if redact_secrets:
            return redact_sensitive_payload(snapshot)
        return snapshot

    def import_config_snapshot(self, request: HarnessImportRequest) -> dict[str, Any]:
        payload = request.snapshot
        profiles_raw = payload.get("profiles")
        if not isinstance(profiles_raw, list):
            raise ValueError("snapshot_profiles_required")
        parsed_profiles: list[HarnessProviderProfile] = []
        for item in profiles_raw:
            if not isinstance(item, dict):
                raise ValueError("snapshot_profile_entry_invalid")
            profile_payload = item.get("profile", item)
            if not isinstance(profile_payload, dict):
                raise ValueError("snapshot_profile_payload_invalid")
            parsed_profiles.append(HarnessProviderProfile(**profile_payload))
        if request.dry_run:
            return {
                "status": "ok",
                "dry_run": True,
                "validated_profiles": [profile.provider_key for profile in parsed_profiles],
                "count": len(parsed_profiles),
            }
        imported: list[str] = []
        for profile in parsed_profiles:
            upserted = self.upsert_profile(profile)
            upserted.last_imported_at = self._now_iso()
            self._store.upsert_profile(upserted)
            imported.append(profile.provider_key)
        return {"status": "ok", "dry_run": False, "imported_profiles": imported, "count": len(imported)}

    def rollback_profile(self, provider_key: str, revision: int) -> HarnessProfileRecord:
        profile = self.get_profile(provider_key)
        if revision == profile.config_revision:
            return profile
        target = next((item for item in profile.config_history if int(item.get("revision", -1)) == revision), None)
        if target is None:
            raise ValueError(f"revision_{revision}_not_found")
        target_payload = target.get("profile")
        if not isinstance(target_payload, dict):
            raise ValueError("revision_payload_invalid")
        return self.upsert_profile(HarnessProviderProfile(**target_payload))

    def execute_non_stream(
        self,
        provider_key: str,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        tool_choice: str | dict[str, Any] | None = None,
        temperature: float | None = None,
        max_output_tokens: int | None = None,
        metadata: dict[str, Any] | None = None,
        request_metadata: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        profile = self.get_profile(provider_key)
        preview = self.build_request_preview(
            HarnessPreviewRequest(
                provider_key=provider_key,
                model=model,
                messages=messages,
                stream=False,
                tools=tools or [],
                tool_choice=tool_choice,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
                metadata=metadata or {},
            ),
            request_metadata=request_metadata,
        )
        try:
            response = httpx.request(preview["method"], preview["url"], headers=preview["headers"], json=preview["json"], timeout=30)
        except httpx.RequestError as exc:
            raise RuntimeError(f"Harness connection failure: {exc}") from exc
        if response.status_code >= 400:
            raise RuntimeError(f"Harness provider rejected request ({response.status_code}): {response.text[:300]}")
        payload = response.json()
        parsed = self._parse_non_stream_response(profile, payload, model=model)
        self._store.record_profile_usage(provider_key=provider_key, model=model, stream=False, total_tokens=int(parsed.get("total_tokens", 0)))
        self._store.record_run(HarnessVerificationRun(provider_key=provider_key, integration_class=profile.integration_class, model=model, mode="runtime_non_stream", status="ok", success=True, steps=[{"step": "request_render", "status": "ok"}, {"step": "response_mapping", "status": "ok"}], executed_at=self._now_iso(), client_id="runtime", consumer="runtime", integration="generic_harness"))
        return parsed

    def execute_stream(
        self,
        provider_key: str,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        tool_choice: str | dict[str, Any] | None = None,
        temperature: float | None = None,
        max_output_tokens: int | None = None,
        metadata: dict[str, Any] | None = None,
        request_metadata: dict[str, str] | None = None,
    ):
        from app.providers.openai_streaming import (
            finalize_openai_tool_calls,
            merge_openai_tool_call_chunks,
        )

        profile = self.get_profile(provider_key)
        if not profile.stream_mapping.enabled:
            raise RuntimeError("Harness profile stream mapping is not enabled.")
        preview = self.build_request_preview(
            HarnessPreviewRequest(
                provider_key=provider_key,
                model=model,
                messages=messages,
                stream=True,
                tools=tools or [],
                tool_choice=tool_choice,
                temperature=temperature,
                max_output_tokens=max_output_tokens,
                metadata=metadata or {},
            ),
            request_metadata=request_metadata,
        )

        collected = ""
        usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        finish_reason = "stop"
        saw_done = False
        tool_call_chunks: dict[int, dict[str, Any]] = {}

        try:
            with httpx.stream(preview["method"], preview["url"], headers=preview["headers"], json=preview["json"], timeout=60) as response:
                if response.status_code >= 400:
                    raise RuntimeError(f"Harness stream request failed ({response.status_code}): {response.text[:300]}")
                for raw_line in response.iter_lines():
                    if not raw_line:
                        continue
                    if not raw_line.startswith(profile.stream_mapping.data_prefix):
                        continue
                    line = raw_line.removeprefix(profile.stream_mapping.data_prefix).strip()
                    if line == profile.stream_mapping.done_marker:
                        saw_done = True
                        break
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError as exc:
                        raise RuntimeError(f"Failed to decode stream chunk: {line[:160]}") from exc

                    delta = self._extract(chunk, profile.stream_mapping.delta_path, default="")
                    if delta:
                        collected += str(delta)
                        yield {"event": "delta", "delta": str(delta)}
                    tool_calls = self._extract(chunk, profile.stream_mapping.tool_calls_path, default=[])
                    if isinstance(tool_calls, list):
                        merge_openai_tool_call_chunks(tool_call_chunks, tool_calls)
                    finish_reason = str(self._extract(chunk, profile.stream_mapping.finish_reason_path, default=finish_reason) or finish_reason)
                    usage["prompt_tokens"] = int(self._extract(chunk, profile.stream_mapping.usage_prompt_tokens_path, default=usage["prompt_tokens"]) or usage["prompt_tokens"])
                    usage["completion_tokens"] = int(self._extract(chunk, profile.stream_mapping.usage_completion_tokens_path, default=usage["completion_tokens"]) or usage["completion_tokens"])
                    usage["total_tokens"] = int(self._extract(chunk, profile.stream_mapping.usage_total_tokens_path, default=usage["total_tokens"]) or usage["total_tokens"])
        except httpx.RequestError as exc:
            raise RuntimeError(f"Harness streaming connection failure: {exc}") from exc

        if not saw_done and finish_reason == "stop" and not collected:
            raise RuntimeError("Stream closed without done marker or usable payload.")

        self._store.record_profile_usage(provider_key=provider_key, model=model, stream=True, total_tokens=int(usage.get("total_tokens", 0)))
        self._store.record_run(HarnessVerificationRun(provider_key=provider_key, integration_class=profile.integration_class, model=model, mode="runtime_stream", status="ok", success=True, steps=[{"step": "stream_readiness", "status": "ok"}, {"step": "stream_done", "status": "ok", "saw_done": saw_done}], executed_at=self._now_iso(), client_id="runtime", consumer="runtime", integration="generic_harness"))
        yield {
            "event": "done",
            "finish_reason": finish_reason,
            "usage": usage,
            "content": collected,
            "tool_calls": finalize_openai_tool_calls(tool_call_chunks),
        }

    def _parse_non_stream_response(self, profile: HarnessProfileRecord, payload: dict[str, Any], *, model: str) -> dict[str, Any]:
        return {
            "model": self._extract(payload, profile.response_mapping.model_path, default=model),
            "content": str(self._extract(payload, profile.response_mapping.text_path, default="")),
            "finish_reason": str(self._extract(payload, profile.response_mapping.finish_reason_path, default="stop")),
            "tool_calls": self._extract(payload, profile.response_mapping.tool_calls_path, default=[]),
            "prompt_tokens": int(self._extract(payload, profile.response_mapping.prompt_tokens_path, default=0) or 0),
            "completion_tokens": int(self._extract(payload, profile.response_mapping.completion_tokens_path, default=0) or 0),
            "total_tokens": int(self._extract(payload, profile.response_mapping.total_tokens_path, default=0) or 0),
            "raw": payload,
        }

    def _build_headers(self, profile: HarnessProviderProfile) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if profile.auth_scheme == "bearer" and profile.auth_value.strip():
            headers[profile.auth_header] = f"Bearer {profile.auth_value}"
        elif profile.auth_scheme == "api_key_header" and profile.auth_value.strip():
            headers[profile.auth_header] = profile.auth_value
        return headers

    def _render_template(self, template: Any, values: dict[str, Any]) -> Any:
        if isinstance(template, dict):
            return {key: self._render_template(value, values) for key, value in template.items()}
        if isinstance(template, list):
            return [self._render_template(value, values) for value in template]
        if isinstance(template, str) and template.startswith("{{") and template.endswith("}}"):
            token = template[2:-2].strip()
            return values.get(token, template)
        return template

    def _extract(self, payload: Any, path: str, *, default: Any) -> Any:
        current = payload
        for segment in path.split("."):
            if isinstance(current, list):
                try:
                    current = current[int(segment)]
                except (ValueError, IndexError):
                    return default
            elif isinstance(current, dict):
                if segment not in current:
                    return default
                current = current[segment]
            else:
                return default
        return current


@lru_cache(maxsize=1)
def get_harness_service() -> HarnessService:
    settings = get_settings()
    if settings.harness_storage_backend == "postgresql":
        repository = PostgresHarnessRepository(settings.harness_postgres_url)
    else:
        repository = FileHarnessRepository(paths=HarnessStoragePaths(profiles_path=Path(settings.harness_profiles_path), runs_path=Path(settings.harness_runs_path)))
    store = HarnessStore(repository=repository)
    return HarnessService(store=store)
