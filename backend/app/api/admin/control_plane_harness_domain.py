"""Harness-focused control-plane behavior."""

from __future__ import annotations

from app.harness import HarnessImportRequest, HarnessPreviewRequest, HarnessProviderProfile, HarnessVerificationRequest
from app.harness.redaction import redact_sensitive_payload as _redact_sensitive_payload


class ControlPlaneHarnessDomainMixin:
    def list_harness_templates(self) -> list[dict[str, object]]:
        return self._harness.list_templates()

    def upsert_harness_profile(self, payload: HarnessProviderProfile):
        return self._harness.upsert_profile(payload)

    def delete_harness_profile(self, provider_key: str) -> None:
        self._harness.delete_profile(provider_key)

    def set_harness_profile_active(self, provider_key: str, enabled: bool):
        return self._harness.set_profile_active(provider_key, enabled)

    def list_harness_profiles(self):
        return self._harness.list_profiles()

    def harness_preview(self, payload: HarnessPreviewRequest) -> dict[str, object]:
        preview = self._harness.preview(payload)
        return {"status": "ok", "preview": preview}

    def harness_dry_run(self, payload: HarnessPreviewRequest) -> dict[str, object]:
        result = self._harness.dry_run(payload)
        return {"status": "ok", **result}

    def harness_probe(self, payload: HarnessPreviewRequest) -> dict[str, object]:
        try:
            result = self._harness.probe(payload)
        except RuntimeError:
            self._analytics.record_integration_error(
                provider=payload.provider_key,
                model=payload.model,
                integration_class="harness_probe",
                template_id=None,
                test_phase="probe",
                error_type="probe_runtime_error",
                status_code=422,
                client_id="control_plane",
                profile_key=payload.provider_key,
            )
            raise
        if int(result["status_code"]) >= 400:
            self._analytics.record_integration_error(
                provider=payload.provider_key,
                model=payload.model,
                integration_class="harness_probe",
                template_id=None,
                test_phase="probe",
                error_type="probe_failed",
                status_code=int(result["status_code"]),
                client_id="control_plane",
                profile_key=payload.provider_key,
            )
        return _redact_sensitive_payload({"status": "ok", **result})

    def verify_harness_profile(self, payload: HarnessVerificationRequest) -> dict[str, object]:
        result = self._harness.verify_profile(payload)
        for step in result.steps:
            if step["status"] in {"failed", "error"}:
                self._analytics.record_integration_error(
                    provider=payload.provider_key,
                    model=payload.model,
                    integration_class=result.integration_class,
                    template_id=None,
                    test_phase=str(step["step"]),
                    error_type="harness_step_failed",
                    status_code=422,
                    client_id="control_plane",
                    profile_key=payload.provider_key,
                )
        return result.model_dump()

    def harness_snapshot(self) -> dict[str, object]:
        return {"status": "ok", "snapshot": self._harness.export_snapshot()}

    def export_harness_config(self, *, redact_secrets: bool = True) -> dict[str, object]:
        return {"status": "ok", "snapshot": self._harness.export_config_snapshot(redact_secrets=redact_secrets)}

    def import_harness_config(self, payload: HarnessImportRequest) -> dict[str, object]:
        return self._harness.import_config_snapshot(payload)

    def rollback_harness_profile(self, provider_key: str, revision: int):
        return self._harness.rollback_profile(provider_key, revision)

    def harness_runs(
        self,
        provider_key: str | None = None,
        mode: str | None = None,
        status: str | None = None,
        client_id: str | None = None,
        limit: int = 200,
    ) -> dict[str, object]:
        runs = self._harness.list_runs(
            provider_key,
            mode=mode,
            status=status,
            client_id=client_id,
            limit=limit,
        )
        profiles = self._harness.list_profiles()
        last_failed = next((run for run in runs if not run.success), None)
        runs_by_provider: dict[str, int] = {}
        for run in runs:
            runs_by_provider[run.provider_key] = runs_by_provider.get(run.provider_key, 0) + 1
        return {
            "status": "ok",
            "runs": [_redact_sensitive_payload(item.model_dump()) for item in runs],
            "summary": self._harness.runs_summary(provider_key),
            "ops": {
                "profile_count": len(profiles),
                "profiles_needing_attention": len([profile for profile in profiles if profile.needs_attention]),
                "runs_by_provider": runs_by_provider,
                "last_failed_run": _redact_sensitive_payload(last_failed.model_dump()) if last_failed else None,
            },
        }
