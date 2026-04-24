"""Provider catalog, evidence, and signoff projection for V9 provider work."""

from __future__ import annotations

from datetime import UTC, datetime

from app.control_plane import (
    ProviderCatalogEvidenceRecord,
    ProviderCatalogRecord,
    ProviderCatalogSignoffRecord,
    ProviderCatalogSummaryRecord,
)
from app.control_plane.provider_catalog_seed import (
    ProviderCatalogSeedRow,
    load_provider_catalog_seed,
)
from app.harness.templates import BUILTIN_TEMPLATES


_EXACT_RUNTIME_BINDINGS = {
    "openai": "openai_api",
    "openai_codex": "openai_codex",
    "gemini_native": "gemini",
    "google_gemini_oauth": "gemini",
    "anthropic": "anthropic",
    "bedrock": "bedrock",
    "ollama": "ollama",
}
_SHIPPED_RUNTIME_BINDINGS = frozenset(_EXACT_RUNTIME_BINDINGS.values())

_OAUTH_TARGET_BINDINGS = {
    "openai_codex": "openai_codex",
    "google_gemini_oauth": "gemini",
    "github_copilot": "github_copilot",
    "claude_code": "claude_code",
    "antigravity": "antigravity",
    "nous_oauth": "nous_oauth",
    "qwen_oauth": "qwen_oauth",
}

_PRODUCT_AXIS_BINDINGS = {
    "continue_openai": "openai_client_compat",
    "openwebui": "openai_client_compat",
    "microsoft_agent_framework": "openai_client_compat",
    "ollama": "ollama",
    "localai": "localai",
    "llama_cpp": "llama_cpp",
    "llama_cpp_python": "llama_cpp_python",
    "vllm": "vllm",
    "nous_oauth": "nous_oauth",
    "qwen_oauth": "qwen_oauth",
}

_UNIT_TESTED_PROVIDERS = {
    "openai",
    "openai_codex",
    "gemini_native",
    "google_gemini_oauth",
    "anthropic",
    "bedrock",
    "minimax",
    "ollama",
}

_ERROR_FIDELITY_PROVIDERS = {"openai", "openai_codex", "anthropic", "gemini_native", "ollama"}
_CREDENTIAL_REFRESH_PROVIDERS = {"openai_codex", "google_gemini_oauth"}

_EVIDENCE_STATUS_ORDER = [
    "live_probe_verified",
    "tool_calling_verified",
    "streaming_verified",
    "repo_observed",
    "docs_declared",
]


class ControlPlaneProviderCatalogDomainMixin:
    @staticmethod
    def _catalog_now_iso() -> str:
        return datetime.now(tz=UTC).isoformat()

    @staticmethod
    def _catalog_product_axis(provider_class: str) -> str:
        if provider_class in {"oauth_account_runtime", "oauth_cli_bridge", "external_process"}:
            return "oauth_account_providers"
        if provider_class in {"openai_compatible_local"}:
            return "local_providers"
        if provider_class in {"client_config_reference", "agent_endpoint_compat"}:
            return "openai_compatible_clients"
        if provider_class in {"anthropic_messages", "gemini_native", "bedrock_converse"}:
            return "unmapped_native_runtime"
        if provider_class in {"openai_compatible", "openai_compatible_aggregator"}:
            return "openai_compatible_providers"
        return "unknown"

    def _catalog_runtime_binding(self, seed: ProviderCatalogSeedRow) -> tuple[str | None, str | None, str | None]:
        runtime_provider = _EXACT_RUNTIME_BINDINGS.get(seed.provider_id)
        oauth_target = _OAUTH_TARGET_BINDINGS.get(seed.provider_id)
        product_axis_binding = _PRODUCT_AXIS_BINDINGS.get(seed.provider_id)
        if product_axis_binding is None and seed.provider_class in {"openai_compatible", "openai_compatible_aggregator"}:
            product_axis_binding = "openai_compatible_generic"
        if product_axis_binding is None and seed.provider_class in {"openai_compatible_local", "oauth_account_runtime"}:
            product_axis_binding = seed.provider_id
        return runtime_provider, oauth_target, product_axis_binding

    @staticmethod
    def _catalog_harness_template_id(entry: ProviderCatalogRecord) -> str | None:
        candidate_ids = [f"openai_provider_{entry.provider_id}"]
        if entry.provider_id == "ollama":
            candidate_ids.append("ollama_local")
        for template_id in candidate_ids:
            if template_id in BUILTIN_TEMPLATES:
                return template_id
        return None

    def _build_catalog_base_record(self, seed: ProviderCatalogSeedRow) -> ProviderCatalogRecord:
        runtime_provider_binding, oauth_target_binding, product_axis_binding = self._catalog_runtime_binding(seed)
        return ProviderCatalogRecord(
            provider_id=seed.provider_id,
            display_name=seed.display_name,
            raw_class=seed.raw_class,
            provider_class=seed.provider_class,  # type: ignore[arg-type]
            source_kind=seed.source_kind,  # type: ignore[arg-type]
            source_docs=list(seed.source_docs),
            local_reference_paths=list(seed.local_reference_paths),
            auth_modes_supported=list(seed.auth_modes_supported),
            api_modes_supported=list(seed.api_modes_supported),
            primary_contracts=list(seed.primary_contracts),
            base_url_default=seed.base_url_default,
            base_url_override_env=seed.base_url_override_env,
            token_env_vars=list(seed.token_env_vars),
            model_name_policy=seed.model_name_policy,
            streaming_support_claim=seed.streaming_support_claim,
            tools_support_claim=seed.tools_support_claim,
            responses_support_claim=seed.responses_support_claim,
            product_axis=self._catalog_product_axis(seed.provider_class),
            runtime_provider_binding=runtime_provider_binding,
            oauth_target_binding=oauth_target_binding,
            product_axis_binding=product_axis_binding,
        )

    @staticmethod
    def _append_if_changed(
        existing: list[ProviderCatalogEvidenceRecord],
        current: ProviderCatalogEvidenceRecord,
        *,
        now_iso: str,
    ) -> None:
        previous = next(
            (item for item in reversed(existing) if item.evidence_class == current.evidence_class and item.target_key == current.target_key),
            None,
        )
        if previous and previous.status == current.status and previous.details == current.details and previous.source_ref == current.source_ref:
            return
        existing.append(current.model_copy(update={"recorded_at": current.recorded_at or now_iso}))

    @staticmethod
    def _append_signoff_if_changed(
        existing: list[ProviderCatalogSignoffRecord],
        current: ProviderCatalogSignoffRecord,
        *,
        now_iso: str,
    ) -> None:
        previous = next(
            (item for item in reversed(existing) if item.target_key == current.target_key),
            None,
        )
        if previous and previous.status == current.status and previous.details == current.details:
            return
        existing.append(current.model_copy(update={"recorded_at": current.recorded_at or now_iso}))

    def _oauth_target_status_by_key(self, tenant_id: str | None = None) -> dict[str, dict[str, object]]:
        status_map: dict[str, dict[str, object]] = {}
        try:
            for item in self.list_oauth_account_target_statuses(tenant_id=tenant_id):
                provider_key = str(item.get("provider_key") or "")
                if provider_key:
                    status_map[provider_key] = item
        except Exception:
            return {}
        return status_map

    def _product_axis_target_map(self, tenant_id: str | None = None) -> dict[str, dict[str, object]]:
        return {
            str(item.get("provider_key") or ""): item
            for item in self.product_axis_targets(tenant_id=tenant_id)
            if item.get("provider_key")
        }

    def _provider_catalog_evidence_snapshot(
        self,
        entry: ProviderCatalogRecord,
        *,
        tenant_id: str | None = None,
        current_provider_keys: set[str] | None = None,
        oauth_statuses: dict[str, dict[str, object]] | None = None,
        product_axis_targets: dict[str, dict[str, object]] | None = None,
    ) -> list[ProviderCatalogEvidenceRecord]:
        current_provider_keys = current_provider_keys or {provider.provider for provider in self.list_providers()}
        oauth_statuses = oauth_statuses or self._oauth_target_status_by_key(tenant_id=tenant_id)
        product_axis_targets = product_axis_targets or self._product_axis_target_map(tenant_id=tenant_id)
        template_id = self._catalog_harness_template_id(entry)
        records: list[ProviderCatalogEvidenceRecord] = [
            ProviderCatalogEvidenceRecord(
                provider_id=entry.provider_id,
                evidence_class="docs_declared",
                status="observed",
                source_kind=entry.source_kind,
                source_ref=entry.source_docs[0] if entry.source_docs else None,
                details="Provider is declared in the V9 provider documentation package.",
            ),
            ProviderCatalogEvidenceRecord(
                provider_id=entry.provider_id,
                evidence_class="contract_tested",
                status="observed",
                source_kind="repo_tests",
                source_ref="backend/tests/test_provider_catalog_v9.py",
                details="Provider catalog projection is covered by repository tests; this does not claim live runtime parity.",
            ),
            ProviderCatalogEvidenceRecord(
                provider_id=entry.provider_id,
                evidence_class="ui_operator_verified",
                status="observed",
                source_kind="repo_ui",
                source_ref="frontend/src/features/providers/ProvidersSections.tsx",
                details="Provider catalog is rendered on the operator provider surface.",
            ),
        ]

        runtime_binding_shipped = (
            entry.runtime_provider_binding is not None
            and entry.runtime_provider_binding in _SHIPPED_RUNTIME_BINDINGS
        )
        if entry.runtime_provider_binding and (
            entry.runtime_provider_binding in current_provider_keys or runtime_binding_shipped
        ):
            records.append(
                ProviderCatalogEvidenceRecord(
                    provider_id=entry.provider_id,
                    evidence_class="repo_observed",
                    status="observed",
                    source_kind=(
                        "repo_runtime"
                        if entry.runtime_provider_binding in current_provider_keys
                        else "repo_runtime_binding"
                    ),
                    source_ref=f"runtime:{entry.runtime_provider_binding}",
                    details=(
                        f"Native runtime provider binding '{entry.runtime_provider_binding}' is active in the current repository."
                        if entry.runtime_provider_binding in current_provider_keys
                        else f"Native runtime provider binding '{entry.runtime_provider_binding}' is shipped in the repository, even if it is not active on this host."
                    ),
                )
            )
            provider_evidence = self._provider_capability_evidence(entry.runtime_provider_binding, tenant_id=tenant_id)
            records.extend(
                [
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        target_key=entry.runtime_provider_binding,
                        evidence_class="live_probe_verified",
                        status=(provider_evidence.live_probe.status if provider_evidence.live_probe.status != "missing" else "blocked-by-live-evidence"),  # type: ignore[arg-type]
                        source_kind=provider_evidence.live_probe.source,
                        source_ref=entry.runtime_provider_binding,
                        recorded_at=provider_evidence.live_probe.recorded_at,
                        details=provider_evidence.live_probe.details,
                    ),
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        target_key=entry.runtime_provider_binding,
                        evidence_class="streaming_verified",
                        status=(provider_evidence.streaming.status if provider_evidence.streaming.status != "missing" else "blocked-by-live-evidence"),  # type: ignore[arg-type]
                        source_kind=provider_evidence.streaming.source,
                        source_ref=entry.runtime_provider_binding,
                        recorded_at=provider_evidence.streaming.recorded_at,
                        details=provider_evidence.streaming.details,
                    ),
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        target_key=entry.runtime_provider_binding,
                        evidence_class="tool_calling_verified",
                        status=(provider_evidence.tool_calling.status if provider_evidence.tool_calling.status != "missing" else "blocked-by-live-evidence"),  # type: ignore[arg-type]
                        source_kind=provider_evidence.tool_calling.source,
                        source_ref=entry.runtime_provider_binding,
                        recorded_at=provider_evidence.tool_calling.recorded_at,
                        details=provider_evidence.tool_calling.details,
                    ),
                ]
            )
        elif entry.oauth_target_binding and entry.oauth_target_binding in oauth_statuses:
            oauth_status = oauth_statuses[entry.oauth_target_binding]
            evidence = oauth_status.get("evidence") or {}
            live_probe = evidence.get("live_probe") or {}
            runtime = evidence.get("runtime") or {}
            streaming = evidence.get("streaming") or {}
            tool_calling = evidence.get("tool_calling") or {}
            records.append(
                ProviderCatalogEvidenceRecord(
                    provider_id=entry.provider_id,
                    evidence_class="repo_observed",
                    status="observed",
                    source_kind="repo_oauth_surface",
                    source_ref=f"oauth:{entry.oauth_target_binding}",
                    details=f"OAuth/account onboarding surface '{entry.oauth_target_binding}' exists in the current repository.",
                )
            )
            records.extend(
                [
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        target_key=entry.oauth_target_binding,
                        evidence_class="live_probe_verified",
                        status=live_probe.get("status", "blocked-by-live-evidence"),
                        source_kind=str(live_probe.get("source") or "oauth_probe"),
                        source_ref=entry.oauth_target_binding,
                        recorded_at=live_probe.get("recorded_at"),
                        details=str(live_probe.get("details") or "No live probe evidence recorded yet."),
                    ),
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        target_key=entry.oauth_target_binding,
                        evidence_class="streaming_verified",
                        status=streaming.get("status", "blocked-by-live-evidence"),
                        source_kind=str(streaming.get("source") or "none"),
                        source_ref=entry.oauth_target_binding,
                        recorded_at=streaming.get("recorded_at"),
                        details=str(streaming.get("details") or "No streaming evidence recorded yet."),
                    ),
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        target_key=entry.oauth_target_binding,
                        evidence_class="tool_calling_verified",
                        status=tool_calling.get("status", "blocked-by-live-evidence"),
                        source_kind=str(tool_calling.get("source") or "none"),
                        source_ref=entry.oauth_target_binding,
                        recorded_at=tool_calling.get("recorded_at"),
                        details=str(tool_calling.get("details") or "No tool-calling evidence recorded yet."),
                    ),
                ]
            )
            if runtime:
                records.append(
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        target_key=entry.oauth_target_binding,
                        evidence_class="error_fidelity_verified",
                        status="missing",
                        source_kind="repo_runtime_gap",
                        source_ref=entry.oauth_target_binding,
                        details=str(runtime.get("details") or "Runtime path exists, but typed error fidelity is not yet separately evidenced."),
                    )
                )
        elif template_id and entry.provider_class in {"openai_compatible", "openai_compatible_aggregator", "openai_compatible_local"}:
            source_kind = "repo_harness_template" if template_id else "repo_harness"
            source_ref = template_id or "generic_harness"
            repo_details = (
                f"Exact generic harness template '{template_id}' exists for this provider row."
                if template_id
                else "Generic OpenAI-compatible provider framework exists through the harness adapter and onboarding surface."
            )
            records.extend(
                [
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        evidence_class="repo_observed",
                        status="observed",
                        source_kind=source_kind,
                        source_ref=source_ref,
                        details=repo_details,
                    ),
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        evidence_class="live_probe_verified",
                        status="blocked-by-live-evidence",
                        source_kind=source_kind,
                        source_ref=source_ref,
                        details="Exact provider wiring exists, but this row still has no live probe evidence.",
                    ),
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        evidence_class="streaming_verified",
                        status="blocked-by-live-evidence",
                        source_kind=source_kind,
                        source_ref=source_ref,
                        details="Streaming-capable framework wiring exists, but this exact provider has no recorded streaming evidence yet.",
                    ),
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        evidence_class="tool_calling_verified",
                        status="blocked-by-live-evidence",
                        source_kind=source_kind,
                        source_ref=source_ref,
                        details="Tool-capable framework wiring exists, but this exact provider has no recorded tool-call evidence yet.",
                    ),
                ]
            )
        elif entry.product_axis_binding == "openai_compatible_generic" and "generic_harness" in current_provider_keys:
            records.extend(
                [
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        evidence_class="repo_observed",
                        status="observed",
                        source_kind="repo_harness",
                        source_ref="generic_harness",
                        details="Generic OpenAI-compatible provider framework exists through the harness adapter and onboarding surface.",
                    ),
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        evidence_class="live_probe_verified",
                        status="blocked-by-live-evidence",
                        source_kind="repo_harness",
                        source_ref="generic_harness",
                        details="Generic harness wiring exists, but this exact provider has no recorded live probe yet.",
                    ),
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        evidence_class="streaming_verified",
                        status="blocked-by-live-evidence",
                        source_kind="repo_harness",
                        source_ref="generic_harness",
                        details="Generic harness wiring exists, but this exact provider has no recorded streaming evidence yet.",
                    ),
                    ProviderCatalogEvidenceRecord(
                        provider_id=entry.provider_id,
                        evidence_class="tool_calling_verified",
                        status="blocked-by-live-evidence",
                        source_kind="repo_harness",
                        source_ref="generic_harness",
                        details="Generic harness wiring exists, but this exact provider has no recorded tool-call evidence yet.",
                    ),
                ]
            )
        elif entry.product_axis_binding == "openai_client_compat" and "openai_client_compat" in product_axis_targets:
            records.append(
                ProviderCatalogEvidenceRecord(
                    provider_id=entry.provider_id,
                    evidence_class="repo_observed",
                    status="observed",
                    source_kind="repo_client_compat",
                    source_ref="openai_client_compat",
                    details="Client/OpenAI-compatible control-plane surface exists for this compatibility-oriented provider class.",
                )
            )
            records.append(
                ProviderCatalogEvidenceRecord(
                    provider_id=entry.provider_id,
                    evidence_class="live_probe_verified",
                    status="skipped",
                    source_kind="repo_client_compat",
                    source_ref="openai_client_compat",
                    details="Client-config/reference rows do not claim a direct provider live probe in the current repository.",
                )
            )
        else:
            records.append(
                ProviderCatalogEvidenceRecord(
                    provider_id=entry.provider_id,
                    evidence_class="repo_observed",
                    status="missing",
                    source_kind="repo_gap",
                    details="No runtime adapter, onboarding surface, or generic framework binding is currently wired for this provider row.",
                )
            )

        if entry.provider_id in _UNIT_TESTED_PROVIDERS:
            records.append(
                ProviderCatalogEvidenceRecord(
                    provider_id=entry.provider_id,
                    evidence_class="unit_tested",
                    status="observed",
                    source_kind="repo_tests",
                    source_ref="backend/tests/test_provider_contract.py",
                    details="Repository unit tests cover a first-party runtime or auth surface for this provider row.",
                )
            )
        if entry.provider_id in _ERROR_FIDELITY_PROVIDERS:
            records.append(
                ProviderCatalogEvidenceRecord(
                    provider_id=entry.provider_id,
                    evidence_class="error_fidelity_verified",
                    status="observed",
                    source_kind="repo_tests",
                    source_ref="backend/tests/test_runtime_error_mapping.py",
                    details="Typed runtime error mapping is covered by repository tests for the shipped surface behind this row.",
                )
            )
        if entry.provider_id in _CREDENTIAL_REFRESH_PROVIDERS:
            records.append(
                ProviderCatalogEvidenceRecord(
                    provider_id=entry.provider_id,
                    evidence_class="credential_refresh_verified",
                    status="blocked-by-live-evidence",
                    source_kind="repo_auth",
                    source_ref=entry.oauth_target_binding or entry.runtime_provider_binding,
                    details="Credential refresh semantics are modeled, but no live refresh evidence is recorded on this host.",
                )
            )
        return records

    @staticmethod
    def _catalog_evidence_status(records: list[ProviderCatalogEvidenceRecord]) -> str:
        observed = {record.evidence_class for record in records if record.status == "observed"}
        for evidence_class in _EVIDENCE_STATUS_ORDER:
            if evidence_class in observed:
                return evidence_class
        return "none"

    @staticmethod
    def _catalog_missing_evidence(entry: ProviderCatalogRecord, records: list[ProviderCatalogEvidenceRecord]) -> list[str]:
        relevant = {"repo_observed", "live_probe_verified"}
        if entry.streaming_support_claim not in {"not-applicable", "unknown"}:
            relevant.add("streaming_verified")
        if entry.tools_support_claim not in {"not-applicable", "unknown"}:
            relevant.add("tool_calling_verified")
        if entry.provider_class == "oauth_account_runtime":
            relevant.add("credential_refresh_verified")
        statuses = {record.evidence_class: record.status for record in records}
        labels = {
            "repo_observed": "repo observed",
            "live_probe_verified": "live probe",
            "streaming_verified": "streaming",
            "tool_calling_verified": "tool calling",
            "credential_refresh_verified": "credential refresh",
        }
        missing: list[str] = []
        for evidence_class in sorted(relevant):
            status = statuses.get(evidence_class, "missing")
            if status != "observed":
                missing.append(labels[evidence_class])
        return missing

    @staticmethod
    def _catalog_live_signoff(entry: ProviderCatalogRecord, records: list[ProviderCatalogEvidenceRecord]) -> ProviderCatalogSignoffRecord:
        status_by_class = {record.evidence_class: record for record in records}
        runtime_like_classes = {"openai_compatible", "openai_compatible_aggregator", "openai_compatible_local", "anthropic_messages", "gemini_native", "bedrock_converse", "oauth_account_runtime"}
        if entry.provider_class in {"client_config_reference", "unsupported_documented"}:
            return ProviderCatalogSignoffRecord(
                provider_id=entry.provider_id,
                status="skipped",
                details="This row is documentation or client compatibility only and does not carry a direct live provider signoff contract.",
            )

        live_probe = status_by_class.get("live_probe_verified")
        streaming = status_by_class.get("streaming_verified")
        tool_calling = status_by_class.get("tool_calling_verified")
        if live_probe and live_probe.status == "observed":
            if (
                entry.provider_class not in runtime_like_classes
                or ((not streaming or streaming.status == "observed") and (not tool_calling or tool_calling.status == "observed"))
            ):
                return ProviderCatalogSignoffRecord(
                    provider_id=entry.provider_id,
                    target_key=entry.runtime_provider_binding or entry.oauth_target_binding,
                    status="pending-review",
                    recorded_at=live_probe.recorded_at,
                    details="Live evidence exists, but no explicit V9 signoff record is stored yet.",
                    evidence_basis=["live_probe_verified", "streaming_verified", "tool_calling_verified"],
                )
        return ProviderCatalogSignoffRecord(
            provider_id=entry.provider_id,
            target_key=entry.runtime_provider_binding or entry.oauth_target_binding,
            status="blocked-by-live-evidence",
            details="Missing live evidence blocks any truthful signoff for this provider row.",
            evidence_basis=["live_probe_verified", "streaming_verified", "tool_calling_verified"],
        )

    @staticmethod
    def _catalog_maturity(entry: ProviderCatalogRecord, records: list[ProviderCatalogEvidenceRecord]) -> str:
        status_by_class = {record.evidence_class: record.status for record in records}
        repo_observed = status_by_class.get("repo_observed") == "observed"
        live_probe = status_by_class.get("live_probe_verified") == "observed"
        streaming = status_by_class.get("streaming_verified") == "observed"
        tool_calling = status_by_class.get("tool_calling_verified") == "observed"
        template_bound = any(
            record.evidence_class == "repo_observed" and record.source_kind == "repo_harness_template"
            for record in records
        )

        if not repo_observed:
            return "documented-only"
        if entry.provider_class in {"oauth_cli_bridge", "external_process"}:
            return "bridge-only" if repo_observed else "documented-only"
        if entry.provider_class in {"client_config_reference", "agent_endpoint_compat"}:
            return "contract-ready"
        if entry.provider_class == "oauth_account_runtime" and not live_probe:
            return "onboarding-only"
        if template_bound and not live_probe and not streaming and not tool_calling:
            return "adapter-ready-without-live-proof"
        if entry.runtime_provider_binding and not live_probe and not streaming and not tool_calling:
            return "adapter-ready-without-live-proof"
        if live_probe or streaming or tool_calling:
            if live_probe and (streaming or entry.streaming_support_claim in {"not-applicable", "unknown"}) and (tool_calling or entry.tools_support_claim in {"not-applicable", "unknown"}):
                return "runtime-ready"
            return "partial-runtime"
        return "contract-ready"

    @staticmethod
    def _catalog_next_action(entry: ProviderCatalogRecord) -> str:
        if entry.maturity_status == "documented-only":
            return "Add a real repo surface for this provider before claiming anything beyond documentation."
        if entry.maturity_status == "contract-ready":
            return "Use the generic OpenAI-compatible or client-compat framework and then collect live evidence for this exact provider."
        if entry.maturity_status == "adapter-ready-without-live-proof":
            return "Provide real credentials, run probe/runtime traffic, and record streaming/tool evidence."
        if entry.maturity_status == "onboarding-only":
            return "Configure credentials and enable the native account runtime path before attempting signoff."
        if entry.maturity_status == "bridge-only":
            return "Keep this row bridge-only until a native adapter exists; probe evidence alone must not promote it."
        if entry.maturity_status == "partial-runtime":
            return f"Close the remaining proof gaps: {', '.join(entry.missing_evidence) if entry.missing_evidence else 'review typed runtime evidence'}."
        if entry.maturity_status == "runtime-ready" and entry.live_signoff_status != "signed-off":
            return "Runtime evidence is present; request explicit live review/signoff instead of implying completion."
        return "Maintain regression coverage and refresh live evidence when upstream behavior changes."

    def _materialize_provider_catalog(
        self,
        stored_catalog: list[ProviderCatalogRecord] | None,
    ) -> dict[str, ProviderCatalogRecord]:
        now_iso = self._catalog_now_iso()
        stored_map = {item.provider_id: item.model_copy(deep=True) for item in (stored_catalog or [])}
        materialized: dict[str, ProviderCatalogRecord] = {}
        tenant_id = self._effective_truth_projection_tenant_id(None)
        current_provider_keys = {provider.provider for provider in self.list_providers()}
        oauth_statuses = self._oauth_target_status_by_key(tenant_id=tenant_id)
        product_axis_targets = self._product_axis_target_map(tenant_id=tenant_id)
        for seed in load_provider_catalog_seed():
            entry = self._build_catalog_base_record(seed)
            previous = stored_map.get(seed.provider_id)
            if previous is not None:
                entry.evidence_log = [item.model_copy(deep=True) for item in previous.evidence_log]
                entry.signoff_history = [item.model_copy(deep=True) for item in previous.signoff_history]

            for evidence in self._provider_catalog_evidence_snapshot(
                entry,
                tenant_id=tenant_id,
                current_provider_keys=current_provider_keys,
                oauth_statuses=oauth_statuses,
                product_axis_targets=product_axis_targets,
            ):
                self._append_if_changed(entry.evidence_log, evidence, now_iso=now_iso)

            current_signoff = self._catalog_live_signoff(entry, entry.evidence_log)
            self._append_signoff_if_changed(entry.signoff_history, current_signoff, now_iso=now_iso)

            latest_probe = next(
                (
                    item
                    for item in reversed(entry.evidence_log)
                    if item.evidence_class == "live_probe_verified" and item.status == "observed"
                ),
                None,
            )
            latest_signoff = next((item for item in reversed(entry.signoff_history)), None)
            entry.last_probe_at = latest_probe.recorded_at if latest_probe else None
            entry.live_signoff_status = latest_signoff.status if latest_signoff else "not-requested"
            entry.live_signoff_at = latest_signoff.recorded_at if latest_signoff and latest_signoff.status == "signed-off" else None
            entry.signoff_notes = latest_signoff.details if latest_signoff else None
            entry.evidence_status = self._catalog_evidence_status(entry.evidence_log)
            entry.missing_evidence = self._catalog_missing_evidence(entry, entry.evidence_log)
            entry.maturity_status = self._catalog_maturity(entry, entry.evidence_log)  # type: ignore[assignment]
            entry.safe_next_action = self._catalog_next_action(entry)
            materialized[entry.provider_id] = entry
        return materialized

    def list_provider_catalog(self) -> list[ProviderCatalogRecord]:
        return [item.model_copy(deep=True) for item in sorted(self._provider_catalog_state.values(), key=lambda entry: entry.provider_id)]

    def provider_catalog_summary(self) -> ProviderCatalogSummaryRecord:
        summary = ProviderCatalogSummaryRecord(total_providers=len(self._provider_catalog_state))
        for entry in self._provider_catalog_state.values():
            match entry.maturity_status:
                case "documented-only":
                    summary.documented_only += 1
                case "contract-ready":
                    summary.contract_ready += 1
                case "adapter-ready-without-live-proof":
                    summary.adapter_ready_without_live_proof += 1
                case "onboarding-only":
                    summary.onboarding_only += 1
                case "bridge-only":
                    summary.bridge_only += 1
                case "partial-runtime":
                    summary.partial_runtime += 1
                case "runtime-ready":
                    summary.runtime_ready += 1
                case "fully-integrated":
                    summary.fully_integrated += 1
            match entry.live_signoff_status:
                case "blocked-by-live-evidence":
                    summary.blocked_live_signoffs += 1
                case "pending-review":
                    summary.pending_live_signoffs += 1
                case "signed-off":
                    summary.signed_off += 1
        return summary
