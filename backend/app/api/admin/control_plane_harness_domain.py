"""Harness-focused control-plane behavior."""

from __future__ import annotations

from app.harness import HarnessImportRequest, HarnessPreviewRequest, HarnessProviderProfile, HarnessVerificationRequest
from app.harness.redaction import redact_sensitive_payload as _redact_sensitive_payload


class ControlPlaneHarnessDomainMixin:
    def _resolved_harness_instance_id(self, instance_id: str | None = None) -> str | None:
        normalized_instance_id = (instance_id or "").strip()
        if normalized_instance_id:
            return normalized_instance_id
        return getattr(getattr(self, "_instance", None), "instance_id", None)

    def _latest_harness_run_payload(
        self,
        *,
        provider_key: str,
        mode: str,
        instance_id: str | None = None,
    ) -> dict[str, object] | None:
        resolved_instance_id = self._resolved_harness_instance_id(instance_id)
        runs = self._harness.list_runs(
            provider_key,
            instance_id=resolved_instance_id,
            mode=mode,
            limit=1,
        )
        if not runs:
            return None
        return _redact_sensitive_payload(runs[0].model_dump())

    def list_harness_templates(self) -> list[dict[str, object]]:
        return self._harness.list_templates()

    def upsert_harness_profile(self, payload: HarnessProviderProfile, instance_id: str | None = None):
        return self._harness.upsert_profile(payload, instance_id=self._resolved_harness_instance_id(instance_id))

    def delete_harness_profile(self, provider_key: str, instance_id: str | None = None) -> None:
        self._harness.delete_profile(provider_key, self._resolved_harness_instance_id(instance_id))

    def set_harness_profile_active(self, provider_key: str, enabled: bool, instance_id: str | None = None):
        return self._harness.set_profile_active(provider_key, enabled, self._resolved_harness_instance_id(instance_id))

    def list_harness_profiles(self, instance_id: str | None = None):
        return self._harness.list_profiles(instance_id=self._resolved_harness_instance_id(instance_id))

    def harness_preview(self, payload: HarnessPreviewRequest, instance_id: str | None = None) -> dict[str, object]:
        resolved_instance_id = self._resolved_harness_instance_id(instance_id)
        preview = self._harness.preview(payload, instance_id=resolved_instance_id)
        return {
            "status": "ok",
            "preview": preview,
            "run": self._latest_harness_run_payload(provider_key=payload.provider_key, mode="preview", instance_id=resolved_instance_id),
        }

    def harness_dry_run(self, payload: HarnessPreviewRequest, instance_id: str | None = None) -> dict[str, object]:
        result = self._harness.dry_run(payload, instance_id=self._resolved_harness_instance_id(instance_id))
        return {"status": "ok", **result}

    def harness_probe(self, payload: HarnessPreviewRequest, instance_id: str | None = None) -> dict[str, object]:
        try:
            result = self._harness.probe(payload, instance_id=self._resolved_harness_instance_id(instance_id))
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

    def verify_harness_profile(self, payload: HarnessVerificationRequest, instance_id: str | None = None) -> dict[str, object]:
        resolved_instance_id = self._resolved_harness_instance_id(instance_id)
        result = self._harness.verify_profile(payload, instance_id=resolved_instance_id)
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
        payload_dict = result.model_dump()
        payload_dict["run"] = self._latest_harness_run_payload(
            provider_key=payload.provider_key,
            mode="verify",
            instance_id=resolved_instance_id,
        )
        return payload_dict

    def harness_snapshot(self, instance_id: str | None = None) -> dict[str, object]:
        resolved_instance_id = self._resolved_harness_instance_id(instance_id)
        return {"status": "ok", "snapshot": self._harness.export_snapshot(instance_id=resolved_instance_id)}

    def export_harness_config(self, *, redact_secrets: bool = True, instance_id: str | None = None) -> dict[str, object]:
        resolved_instance_id = self._resolved_harness_instance_id(instance_id)
        return {"status": "ok", "snapshot": self._harness.export_config_snapshot(redact_secrets=redact_secrets, instance_id=resolved_instance_id)}

    def import_harness_config(self, payload: HarnessImportRequest, instance_id: str | None = None) -> dict[str, object]:
        return self._harness.import_config_snapshot(payload, instance_id=self._resolved_harness_instance_id(instance_id))

    def rollback_harness_profile(self, provider_key: str, revision: int, instance_id: str | None = None):
        return self._harness.rollback_profile(provider_key, revision, instance_id=self._resolved_harness_instance_id(instance_id))

    def harness_runs(
        self,
        provider_key: str | None = None,
        mode: str | None = None,
        status: str | None = None,
        client_id: str | None = None,
        limit: int = 200,
        instance_id: str | None = None,
    ) -> dict[str, object]:
        resolved_instance_id = self._resolved_harness_instance_id(instance_id)
        runs = self._harness.list_runs(
            provider_key,
            instance_id=resolved_instance_id,
            mode=mode,
            status=status,
            client_id=client_id,
            limit=limit,
        )
        profiles = self._harness.list_profiles(instance_id=resolved_instance_id)
        last_failed = next((run for run in runs if not run.success), None)
        runs_by_provider: dict[str, int] = {}
        last_runs_by_provider: dict[str, dict[str, object]] = {}
        for run in runs:
            runs_by_provider[run.provider_key] = runs_by_provider.get(run.provider_key, 0) + 1
            if run.provider_key not in last_runs_by_provider:
                last_runs_by_provider[run.provider_key] = _redact_sensitive_payload(run.model_dump())
        summary = {
            "total": len(runs),
            "failed": len([run for run in runs if not run.success]),
            "preview": len([run for run in runs if run.mode == "preview"]),
            "dry_run": len([run for run in runs if run.mode == "dry_run"]),
            "verify": len([run for run in runs if run.mode == "verify"]),
            "probe": len([run for run in runs if run.mode == "probe"]),
            "sync": len([run for run in runs if run.mode == "sync"]),
            "runtime_non_stream": len([run for run in runs if run.mode == "runtime_non_stream"]),
            "runtime_stream": len([run for run in runs if run.mode == "runtime_stream"]),
        }
        return {
            "status": "ok",
            "runs": [_redact_sensitive_payload(item.model_dump()) for item in runs],
            "summary": summary,
            "ops": {
                "profile_count": len(profiles),
                "profiles_needing_attention": len([profile for profile in profiles if profile.needs_attention]),
                "runs_by_provider": runs_by_provider,
                "last_runs_by_provider": last_runs_by_provider,
                "last_failed_run": _redact_sensitive_payload(last_failed.model_dump()) if last_failed else None,
            },
        }
