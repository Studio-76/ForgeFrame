import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { fetchProviderTargets, updateProviderTarget, type ProviderTargetRecord } from "../api/admin";
import {
  getScopedAdminInstanceId,
  sessionCanMutateScopedOrAnyInstance,
  sessionHasScopedOrAnyInstancePermission,
} from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { getInstanceIdFromSearchParams, withInstanceScope } from "../app/tenantScope";
import { useInstanceCatalog } from "../app/useInstanceCatalog";
import { InstanceScopeCard } from "../components/InstanceScopeCard";
import { PageIntro } from "../components/PageIntro";
import { ActionBar } from "../components/ui/ActionBar";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import { DetailPanel } from "../components/ui/DetailPanel";
import { EntityTable, type EntityTableColumn } from "../components/ui/EntityTable";
import { EmptyState, ErrorState, LoadingState, PermissionState } from "../components/ui/StateBlocks";
import { StatusBadge, type StatusTone } from "../components/ui/StatusBadge";
import { SummaryStrip, type SummaryStripItem } from "../components/ui/SummaryStrip";

type LoadState = "idle" | "loading" | "success" | "error";
type CapabilityFilter = "all" | "streaming" | "tool_calling" | "vision" | "queue_eligible";
type TargetStatusFilter = "all" | "ready" | "runtime-ready" | "partial" | "degraded" | "blocked" | "unsupported" | "bridge-only";

type TargetDraft = {
  enabled: boolean;
  priority: string;
  queueEligible: boolean;
  fallbackAllowed: boolean;
  fallbackTargetKeys: string[];
  escalationAllowed: boolean;
  escalationTargetKeys: string[];
  acknowledgeDefaultRisk: boolean;
};

function titleCase(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "Not recorded";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().replace(".000Z", "Z").replace("T", " ");
}

function formatRecordEntries(values: Record<string, unknown>): string {
  const entries = Object.entries(values ?? {});
  return entries.length > 0
    ? entries.map(([key, value]) => `${key}=${String(value)}`).join(" · ")
    : "none";
}

function valueAsString(value: unknown, fallback = "unknown"): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function valueAsBoolean(value: unknown): boolean {
  return value === true;
}

function valueAsStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => valueAsString(entry)).filter(Boolean) : [];
}

function qualityTierOf(target: ProviderTargetRecord): string {
  return valueAsString(target.economic_profile.quality_tier, "standard");
}

function executionLaneOf(target: ProviderTargetRecord): string {
  return valueAsString(target.execution_traits.execution_lane, target.queue_eligible ? "queued_background" : "sync_interactive");
}

function targetDraftFromRecord(target: ProviderTargetRecord): TargetDraft {
  return {
    enabled: target.enabled,
    priority: String(target.priority),
    queueEligible: target.queue_eligible,
    fallbackAllowed: target.fallback_allowed,
    fallbackTargetKeys: [...target.fallback_target_keys],
    escalationAllowed: target.escalation_allowed,
    escalationTargetKeys: [...target.escalation_target_keys],
    acknowledgeDefaultRisk: false,
  };
}

function contractStatusForTarget(target: ProviderTargetRecord): TargetStatusFilter {
  if (!target.enabled) {
    return "blocked";
  }
  if (!target.provider_enabled || !target.model_active) {
    return "blocked";
  }

  const readiness = target.readiness_status.trim().toLowerCase();
  if (readiness === "runtime-ready") {
    return "runtime-ready";
  }
  if (readiness === "bridge-only") {
    return "bridge-only";
  }
  if (readiness === "unsupported") {
    return "unsupported";
  }
  if (readiness === "degraded") {
    return "degraded";
  }
  if (readiness === "partial") {
    return "partial";
  }
  if (readiness === "blocked") {
    return "blocked";
  }
  if (readiness === "ready") {
    if (target.runtime_ready && target.health_status === "healthy" && target.availability_status === "healthy") {
      return "runtime-ready";
    }
    if (!target.runtime_ready) {
      return "partial";
    }
    if (target.health_status !== "healthy" || target.availability_status !== "healthy") {
      return "degraded";
    }
    return "ready";
  }

  return target.runtime_ready ? "partial" : "blocked";
}

function statusLabelForTarget(target: ProviderTargetRecord): string {
  const status = contractStatusForTarget(target);
  if (status === "runtime-ready") {
    return "Runtime ready";
  }
  return titleCase(status);
}

function toneForTargetStatus(status: TargetStatusFilter): StatusTone {
  switch (status) {
    case "runtime-ready":
      return "success";
    case "partial":
    case "degraded":
    case "bridge-only":
      return "warning";
    case "blocked":
      return "danger";
    case "unsupported":
    default:
      return "info";
  }
}

function capabilityList(target: ProviderTargetRecord): string[] {
  const capabilities = new Set<string>();
  if (target.stream_capable || valueAsBoolean(target.capability_profile.streaming)) {
    capabilities.add("streaming");
  }
  if (target.tool_capable || valueAsBoolean(target.capability_profile.tool_calling)) {
    capabilities.add("tool calling");
  }
  if (target.vision_capable || valueAsBoolean(target.capability_profile.vision)) {
    capabilities.add("vision");
  }
  if (target.queue_eligible || valueAsBoolean(target.capability_profile.queue_eligible)) {
    capabilities.add("queue eligible");
  }
  return Array.from(capabilities);
}

function capabilityFilterMatches(target: ProviderTargetRecord, capability: CapabilityFilter): boolean {
  if (capability === "all") {
    return true;
  }
  if (capability === "streaming") {
    return target.stream_capable || valueAsBoolean(target.capability_profile.streaming);
  }
  if (capability === "tool_calling") {
    return target.tool_capable || valueAsBoolean(target.capability_profile.tool_calling);
  }
  if (capability === "vision") {
    return target.vision_capable || valueAsBoolean(target.capability_profile.vision);
  }
  return target.queue_eligible || valueAsBoolean(target.capability_profile.queue_eligible);
}

function targetHasPremiumOrOauthRisk(target: ProviderTargetRecord): boolean {
  return target.auth_type.toLowerCase().includes("oauth")
    || target.credential_type.toLowerCase().includes("oauth")
    || target.cost_class.toLowerCase().includes("high")
    || qualityTierOf(target).toLowerCase().includes("premium");
}

function normalizePriority(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function sortStringValues(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function arraysEqual(left: string[], right: string[]): boolean {
  return JSON.stringify(sortStringValues(left)) === JSON.stringify(sortStringValues(right));
}

function isDefaultEnabledTarget(
  priority: number,
  enabled: boolean,
  otherEnabledPriorities: number[],
): boolean {
  if (!enabled) {
    return false;
  }
  const lowestOtherPriority = otherEnabledPriorities.length > 0 ? Math.min(...otherEnabledPriorities) : null;
  return lowestOtherPriority === null || priority <= lowestOtherPriority;
}

export function ProviderTargetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const scopedInstanceId = getScopedAdminInstanceId(session, instanceId);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);
  const [targets, setTargets] = useState<ProviderTargetRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TargetDraft>>({});
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<TargetStatusFilter>("all");
  const [costClassFilter, setCostClassFilter] = useState("all");
  const [qualityTierFilter, setQualityTierFilter] = useState("all");
  const [capabilityFilter, setCapabilityFilter] = useState<CapabilityFilter>("all");
  const [healthFilter, setHealthFilter] = useState("all");

  const canReadTargets = sessionReady && sessionHasScopedOrAnyInstancePermission(session, scopedInstanceId, "provider_targets.read");
  const canMutate = sessionCanMutateScopedOrAnyInstance(session, scopedInstanceId, "provider_targets.write");

  const load = async () => {
    setState("loading");
    setError("");
    setMessage("");
    try {
      const payload = await fetchProviderTargets(instanceId);
      setTargets(payload.targets);
      setDrafts(Object.fromEntries(payload.targets.map((target) => [target.target_key, targetDraftFromRecord(target)])));
      setSelectedTargetKey((current) => (
        current && payload.targets.some((target) => target.target_key === current)
          ? current
          : (payload.targets[0]?.target_key ?? null)
      ));
      setState("success");
    } catch (loadError) {
      setTargets([]);
      setDrafts({});
      setSelectedTargetKey(null);
      setState("error");
      setError(loadError instanceof Error ? loadError.message : "Provider target register could not be loaded.");
    }
  };

  useEffect(() => {
    if (!canReadTargets) {
      setTargets([]);
      setDrafts({});
      setSelectedTargetKey(null);
      setState("idle");
      setError("");
      setMessage("");
      return;
    }
    void load();
  }, [canReadTargets, instanceId]);

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  const providerOptions = Array.from(new Set(targets.map((target) => target.provider_label ?? target.provider))).sort((left, right) => left.localeCompare(right));
  const costClassOptions = Array.from(new Set(targets.map((target) => target.cost_class))).sort((left, right) => left.localeCompare(right));
  const qualityTierOptions = Array.from(new Set(targets.map((target) => qualityTierOf(target)))).sort((left, right) => left.localeCompare(right));
  const healthOptions = Array.from(new Set(targets.map((target) => target.health_status))).sort((left, right) => left.localeCompare(right));

  const filteredTargets = targets.filter((target) => {
    const providerLabel = target.provider_label ?? target.provider;
    return (providerFilter === "all" || providerLabel === providerFilter)
      && (statusFilter === "all" || contractStatusForTarget(target) === statusFilter)
      && (costClassFilter === "all" || target.cost_class === costClassFilter)
      && (qualityTierFilter === "all" || qualityTierOf(target) === qualityTierFilter)
      && capabilityFilterMatches(target, capabilityFilter)
      && (healthFilter === "all" || target.health_status === healthFilter);
  });

  useEffect(() => {
    if (!selectedTargetKey) {
      if (filteredTargets.length > 0) {
        setSelectedTargetKey(filteredTargets[0].target_key);
      }
      return;
    }
    if (filteredTargets.length === 0) {
      setSelectedTargetKey(null);
      return;
    }
    if (!filteredTargets.some((target) => target.target_key === selectedTargetKey)) {
      setSelectedTargetKey(filteredTargets[0].target_key);
    }
  }, [filteredTargets, selectedTargetKey]);

  const selectedTarget = filteredTargets.find((target) => target.target_key === selectedTargetKey)
    ?? targets.find((target) => target.target_key === selectedTargetKey)
    ?? null;
  const selectedDraft = selectedTarget ? drafts[selectedTarget.target_key] ?? targetDraftFromRecord(selectedTarget) : null;

  const updateDraft = (targetKey: string, update: (current: TargetDraft) => TargetDraft) => {
    setDrafts((current) => {
      const base = current[targetKey] ?? targetDraftFromRecord(targets.find((target) => target.target_key === targetKey)!);
      return {
        ...current,
        [targetKey]: update(base),
      };
    });
  };

  const toggleTargetReference = (targetKey: string, field: "fallbackTargetKeys" | "escalationTargetKeys", referenceKey: string) => {
    updateDraft(targetKey, (current) => {
      const values = current[field].includes(referenceKey)
        ? current[field].filter((item) => item !== referenceKey)
        : [...current[field], referenceKey];
      return { ...current, [field]: values };
    });
  };

  const detailOtherTargets = selectedTarget
    ? targets.filter((target) => target.target_key !== selectedTarget.target_key)
    : [];

  const selectedDraftHasChanges = Boolean(selectedTarget && selectedDraft && (
    selectedDraft.enabled !== selectedTarget.enabled
    || normalizePriority(selectedDraft.priority, selectedTarget.priority) !== selectedTarget.priority
    || selectedDraft.queueEligible !== selectedTarget.queue_eligible
    || selectedDraft.fallbackAllowed !== selectedTarget.fallback_allowed
    || !arraysEqual(selectedDraft.fallbackTargetKeys, selectedTarget.fallback_target_keys)
    || selectedDraft.escalationAllowed !== selectedTarget.escalation_allowed
    || !arraysEqual(selectedDraft.escalationTargetKeys, selectedTarget.escalation_target_keys)
  ));

  const selectedTargetBecomesRiskyDefault = Boolean(selectedTarget && selectedDraft && selectedDraftHasChanges && (() => {
    if (!targetHasPremiumOrOauthRisk(selectedTarget) || !selectedDraft.enabled) {
      return false;
    }
    const proposedPriority = normalizePriority(selectedDraft.priority, selectedTarget.priority);
    const otherEnabledPriorities = targets.flatMap((target) => {
      if (target.target_key === selectedTarget.target_key) {
        return [];
      }
      const draft = drafts[target.target_key];
      const enabled = draft ? draft.enabled : target.enabled;
      const priority = draft ? normalizePriority(draft.priority, target.priority) : target.priority;
      return enabled ? [priority] : [];
    });
    const currentIsDefault = isDefaultEnabledTarget(selectedTarget.priority, selectedTarget.enabled, otherEnabledPriorities);
    const proposedIsDefault = isDefaultEnabledTarget(proposedPriority, selectedDraft.enabled, otherEnabledPriorities);
    return !currentIsDefault && proposedIsDefault;
  })());

  const saveSelectedTarget = async () => {
    if (!selectedTarget || !selectedDraft) {
      return;
    }
    if (!canMutate) {
      setError("This session cannot change provider-target state.");
      return;
    }
    if (selectedTargetBecomesRiskyDefault && !selectedDraft.acknowledgeDefaultRisk) {
      setError("Confirm the premium/OAuth default-target warning before saving this target.");
      return;
    }

    const nextPriority = normalizePriority(selectedDraft.priority, selectedTarget.priority);
    const payload: Parameters<typeof updateProviderTarget>[1] = {};

    if (selectedDraft.enabled !== selectedTarget.enabled) {
      payload.enabled = selectedDraft.enabled;
    }
    if (nextPriority !== selectedTarget.priority) {
      payload.priority = nextPriority;
    }
    if (selectedDraft.queueEligible !== selectedTarget.queue_eligible) {
      payload.queue_eligible = selectedDraft.queueEligible;
    }
    if (selectedDraft.fallbackAllowed !== selectedTarget.fallback_allowed) {
      payload.fallback_allowed = selectedDraft.fallbackAllowed;
    }
    if (!arraysEqual(selectedDraft.fallbackTargetKeys, selectedTarget.fallback_target_keys)) {
      payload.fallback_target_keys = sortStringValues(selectedDraft.fallbackTargetKeys);
    }
    if (selectedDraft.escalationAllowed !== selectedTarget.escalation_allowed) {
      payload.escalation_allowed = selectedDraft.escalationAllowed;
    }
    if (!arraysEqual(selectedDraft.escalationTargetKeys, selectedTarget.escalation_target_keys)) {
      payload.escalation_target_keys = sortStringValues(selectedDraft.escalationTargetKeys);
    }

    if (Object.keys(payload).length === 0) {
      setMessage("No target changes to save.");
      return;
    }

    setError("");
    setMessage("");
    try {
      await updateProviderTarget(selectedTarget.target_key, payload, instanceId);
      setMessage(`Target ${selectedTarget.label} updated.`);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Provider target update failed.");
    }
  };

  const summaryItems: SummaryStripItem[] = [
    {
      key: "targets",
      label: "Targets",
      value: targets.length,
      meta: filteredTargets.length === targets.length ? "All targets visible" : `${filteredTargets.length} match the current filters`,
    },
    {
      key: "enabled",
      label: "Enabled",
      value: targets.filter((target) => target.enabled).length,
      status: targets.some((target) => target.enabled) ? "ready" : "blocked",
      meta: "Dispatch can only consider enabled targets.",
    },
    {
      key: "runtime-ready",
      label: "Runtime-ready",
      value: targets.filter((target) => contractStatusForTarget(target) === "runtime-ready").length,
      status: targets.some((target) => contractStatusForTarget(target) === "runtime-ready") ? "runtime-ready" : "partial",
      meta: "Targets that are enabled, healthy, and backed by provider runtime truth.",
    },
    {
      key: "queue",
      label: "Queue-eligible",
      value: targets.filter((target) => target.queue_eligible).length,
      meta: "Targets allowed on queued execution lanes.",
    },
    {
      key: "premium-oauth",
      label: "Premium / OAuth",
      value: targets.filter((target) => targetHasPremiumOrOauthRisk(target)).length,
      status: targets.some((target) => targetHasPremiumOrOauthRisk(target) && target.enabled) ? "degraded" : "ready",
      meta: "Requires explicit operator intent before becoming the default active path.",
    },
  ];

  const columns: EntityTableColumn<ProviderTargetRecord>[] = [
    {
      key: "target",
      header: "Target",
      render: (target) => (
        <div>
          <button className="fg-table-trigger" type="button" onClick={() => setSelectedTargetKey(target.target_key)}>
            <strong>{target.label}</strong>
          </button>
          <div className="fg-muted">{target.target_key}</div>
          <div className="fg-muted">{target.provider_label ?? target.provider} · {target.model_display_name ?? target.model_id}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (target) => (
        <div className="fg-actions">
          <StatusBadge tone={toneForTargetStatus(contractStatusForTarget(target))} status={contractStatusForTarget(target)}>
            {statusLabelForTarget(target)}
          </StatusBadge>
          <StatusBadge tone={target.enabled ? "success" : "warning"} status={target.enabled ? "ready" : "blocked"}>
            {target.enabled ? "Enabled" : "Disabled"}
          </StatusBadge>
        </div>
      ),
    },
    {
      key: "cost",
      header: "Cost / quality",
      render: (target) => (
        <div>
          <div>{titleCase(target.cost_class)}</div>
          <div className="fg-muted">{titleCase(qualityTierOf(target))}</div>
        </div>
      ),
    },
    {
      key: "capabilities",
      header: "Capabilities",
      render: (target) => capabilityList(target).join(" · ") || "No declared capability",
    },
    {
      key: "health",
      header: "Health",
      render: (target) => (
        <div>
          <div>{titleCase(target.health_status)} · {titleCase(target.availability_status)}</div>
          <div className="fg-muted">Probe {formatTimestamp(target.last_probe_at)}</div>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (target) => target.priority,
    },
  ];

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Routing"
        title="Provider Targets"
        description="Operational target management for the selected instance: enablement, priority, capability shape, queue posture, policy flags, and provider runtime truth."
        question="Which targets are dispatchable right now, and which changes would alter the default runtime path?"
        badges={[
          { label: `${targets.filter((target) => target.enabled).length}/${targets.length || 0} enabled`, tone: targets.some((target) => target.enabled) ? "success" : "warning" },
          { label: `${targets.filter((target) => contractStatusForTarget(target) === "runtime-ready").length} runtime-ready`, tone: targets.some((target) => contractStatusForTarget(target) === "runtime-ready") ? "success" : "warning" },
          ...(selectedInstance ? [{ label: `Instance scope: ${selectedInstance.display_name}`, tone: "success" as const }] : []),
          ...(session ? [{ label: canMutate ? `${session.role} mutations enabled` : "Read-only target view", tone: canMutate ? "success" as const : "warning" as const }] : []),
        ]}
        note="Provider targets are the routing-eligible runtime objects for this instance. Use the detail panel to change enablement, priority, queue posture, and fallback/escalation allowances without blurring health or policy truth."
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="provider target truth"
        onInstanceChange={onInstanceChange}
      />

      <ActionBar
        title="Target controls"
        description="Filter the operational register, refresh live truth, or jump directly to routing and health follow-up."
        actions={(
          <div className="fg-actions">
            <button type="button" onClick={() => void load()} disabled={!canReadTargets}>
              Refresh
            </button>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.models, instanceId)}>Models</Link>
            <Link className="fg-nav-link" to={withInstanceScope(`${CONTROL_PLANE_ROUTES.routing}#routing-dry-run`, instanceId)}>Routing Dry Run</Link>
            <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerHealthRuns, instanceId)}>Provider Health</Link>
          </div>
        )}
      >
        <div className="fg-inline-form" aria-label="Provider target filters">
          <label>
            Provider
            <select aria-label="Provider filter" value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
              <option value="all">All providers</option>
              {providerOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select aria-label="Status filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TargetStatusFilter)}>
              <option value="all">All statuses</option>
              <option value="ready">Ready</option>
              <option value="runtime-ready">Runtime ready</option>
              <option value="partial">Partial</option>
              <option value="degraded">Degraded</option>
              <option value="blocked">Blocked</option>
              <option value="bridge-only">Bridge only</option>
              <option value="unsupported">Unsupported</option>
            </select>
          </label>
          <label>
            Cost class
            <select aria-label="Cost class filter" value={costClassFilter} onChange={(event) => setCostClassFilter(event.target.value)}>
              <option value="all">All cost classes</option>
              {costClassOptions.map((option) => (
                <option key={option} value={option}>{titleCase(option)}</option>
              ))}
            </select>
          </label>
          <label>
            Quality tier
            <select aria-label="Quality tier filter" value={qualityTierFilter} onChange={(event) => setQualityTierFilter(event.target.value)}>
              <option value="all">All quality tiers</option>
              {qualityTierOptions.map((option) => (
                <option key={option} value={option}>{titleCase(option)}</option>
              ))}
            </select>
          </label>
          <label>
            Capability
            <select aria-label="Capability filter" value={capabilityFilter} onChange={(event) => setCapabilityFilter(event.target.value as CapabilityFilter)}>
              <option value="all">All capabilities</option>
              <option value="streaming">Streaming</option>
              <option value="tool_calling">Tool calling</option>
              <option value="vision">Vision</option>
              <option value="queue_eligible">Queue eligible</option>
            </select>
          </label>
          <label>
            Health
            <select aria-label="Health filter" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value)}>
              <option value="all">All health states</option>
              {healthOptions.map((option) => (
                <option key={option} value={option}>{titleCase(option)}</option>
              ))}
            </select>
          </label>
        </div>
      </ActionBar>

      {!canReadTargets ? (
        <PermissionState
          title="Provider target review unavailable"
          description="This session does not hold provider_targets.read on the active instance scope, so ForgeFrame keeps the operational target register closed here."
        />
      ) : null}

      {error && state === "error" ? (
        <ErrorState
          title="Provider target register failed to load"
          description={error}
          action={<button type="button" onClick={() => void load()}>Retry</button>}
        />
      ) : null}

      {state === "loading" && targets.length === 0 ? (
        <LoadingState
          title="Loading provider target truth"
          description="ForgeFrame is restoring target readiness, enablement, policy flags, and runtime proof for the active instance."
        />
      ) : null}

      {canReadTargets && state !== "error" ? <SummaryStrip items={summaryItems} /> : null}

      {canReadTargets && state === "success" && targets.length === 0 ? (
        <EmptyState
          title="No provider targets exist for this instance"
          description="Start from the provider control plane or model register to create routing-eligible targets before trusting runtime dispatch."
          action={<Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providers, instanceId)}>Open providers</Link>}
        />
      ) : null}

      {canReadTargets && targets.length > 0 ? (
        <div className="ff-operator-layout">
          <div className="ff-operator-main">
            <EntityTable
              title="Instance-bound target table"
              description="Each row keeps capability truth, policy flags, health, and economic posture separate so incomplete targets cannot masquerade as ready."
              columns={columns}
              rows={filteredTargets}
              rowKey={(target) => target.target_key}
              tableLabel="Provider targets table"
              getRowClassName={(target) => (selectedTarget && target.target_key === selectedTarget.target_key ? "is-selected" : undefined)}
              emptyTitle="No targets match the active filters"
              emptyDescription="Relax provider, status, cost, quality, capability, or health filters to bring matching targets back into view."
              footer={<p className="fg-muted">Showing {filteredTargets.length} of {targets.length} instance-bound provider targets.</p>}
            />
          </div>

          <div className="ff-operator-sidebar">
            {selectedTarget && selectedDraft ? (
              <DetailPanel
                title={selectedTarget.label}
                description={`${selectedTarget.provider_label ?? selectedTarget.provider} · ${selectedTarget.model_display_name ?? selectedTarget.model_id} · ${selectedTarget.target_key}`}
                status={statusLabelForTarget(selectedTarget)}
                statusTone={toneForTargetStatus(contractStatusForTarget(selectedTarget))}
                statusKey={contractStatusForTarget(selectedTarget)}
                sticky
                actions={(
                  <div className="fg-actions">
                    <Link className="fg-nav-link" to={withInstanceScope(`${CONTROL_PLANE_ROUTES.routing}#routing-dry-run`, selectedTarget.instance_id)}>Routing Dry Run</Link>
                    <Link className="fg-nav-link" to={withInstanceScope(CONTROL_PLANE_ROUTES.providerHealthRuns, selectedTarget.instance_id)}>Provider Health</Link>
                  </div>
                )}
              >
                <div className="fg-stack">
                  {message ? <p>{message}</p> : null}
                  {error && state !== "error" ? <p className="fg-danger">{error}</p> : null}
                  <section className="fg-subcard">
                    <h4>Identity</h4>
                    <p>Auth type: {selectedTarget.auth_type} · credential type: {selectedTarget.credential_type}</p>
                    <p>Model: {selectedTarget.model_display_name ?? selectedTarget.model_id} · owned by {selectedTarget.model_owned_by ?? "unknown"}</p>
                    <p>Execution lane: {executionLaneOf(selectedTarget)} · queue eligible {selectedTarget.queue_eligible ? "yes" : "no"}</p>
                    <p>Last probe: {formatTimestamp(selectedTarget.last_probe_at)}</p>
                  </section>

                  <section className="fg-subcard">
                    <h4>Capabilities</h4>
                    <p>{capabilityList(selectedTarget).join(" · ") || "No declared capability"}</p>
                    <p className="fg-muted">Capability profile: {formatRecordEntries(selectedTarget.capability_profile)}</p>
                    <p className="fg-muted">Technical capabilities: {formatRecordEntries(selectedTarget.technical_capabilities)}</p>
                  </section>

                  <section className="fg-subcard">
                    <h4>Execution traits</h4>
                    <p>{formatRecordEntries(selectedTarget.execution_traits)}</p>
                  </section>

                  <section className="fg-subcard">
                    <h4>Policy flags</h4>
                    <p>{formatRecordEntries(selectedTarget.policy_flags)}</p>
                    <p className="fg-muted">Fallback {selectedTarget.fallback_allowed ? "allowed" : "blocked"} · Escalation {selectedTarget.escalation_allowed ? "allowed" : "blocked"}</p>
                  </section>

                  <section className="fg-subcard">
                    <h4>Cost / quality profile</h4>
                    <p>Cost class: {titleCase(selectedTarget.cost_class)} · quality tier: {titleCase(qualityTierOf(selectedTarget))}</p>
                    <p className="fg-muted">{formatRecordEntries(selectedTarget.economic_profile)}</p>
                  </section>

                  <section className="fg-subcard">
                    <h4>Runtime and health</h4>
                    <p>Readiness: {titleCase(selectedTarget.readiness_status)} · runtime ready {selectedTarget.runtime_ready ? "yes" : "no"}</p>
                    <p>Health: {titleCase(selectedTarget.health_status)} · availability: {titleCase(selectedTarget.availability_status)}</p>
                    <p className="fg-muted">{selectedTarget.runtime_readiness_reason ?? selectedTarget.status_reason ?? "No additional runtime note recorded."}</p>
                  </section>

                  {canMutate ? (
                    <section className="fg-subcard">
                      <h4>Edit target policy</h4>
                      <div className="fg-inline-form">
                        <label>
                          Priority
                          <input
                            aria-label="Priority"
                            type="number"
                            min="0"
                            value={selectedDraft.priority}
                            onChange={(event) => updateDraft(selectedTarget.target_key, (current) => ({ ...current, priority: event.target.value, acknowledgeDefaultRisk: false }))}
                          />
                        </label>
                        <label>
                          <input
                            aria-label="Enable target"
                            type="checkbox"
                            checked={selectedDraft.enabled}
                            onChange={(event) => updateDraft(selectedTarget.target_key, (current) => ({ ...current, enabled: event.target.checked, acknowledgeDefaultRisk: false }))}
                          />
                          <span>Enable target</span>
                        </label>
                        <label>
                          <input
                            aria-label="Queue eligible"
                            type="checkbox"
                            checked={selectedDraft.queueEligible}
                            onChange={(event) => updateDraft(selectedTarget.target_key, (current) => ({ ...current, queueEligible: event.target.checked }))}
                          />
                          <span>Queue eligible</span>
                        </label>
                        <label>
                          <input
                            aria-label="Fallback allowed"
                            type="checkbox"
                            checked={selectedDraft.fallbackAllowed}
                            onChange={(event) => updateDraft(selectedTarget.target_key, (current) => ({ ...current, fallbackAllowed: event.target.checked }))}
                          />
                          <span>Fallback allowed</span>
                        </label>
                        <label>
                          <input
                            aria-label="Escalation allowed"
                            type="checkbox"
                            checked={selectedDraft.escalationAllowed}
                            onChange={(event) => updateDraft(selectedTarget.target_key, (current) => ({ ...current, escalationAllowed: event.target.checked }))}
                          />
                          <span>Escalation allowed</span>
                        </label>
                      </div>

                      {detailOtherTargets.length > 0 ? (
                        <>
                          <div className="fg-stack">
                            <strong>Fallback targets</strong>
                            <div className="fg-inline-form">
                              {detailOtherTargets.map((target) => (
                                <label key={`fallback-${target.target_key}`}>
                                  <input
                                    type="checkbox"
                                    checked={selectedDraft.fallbackTargetKeys.includes(target.target_key)}
                                    onChange={() => toggleTargetReference(selectedTarget.target_key, "fallbackTargetKeys", target.target_key)}
                                  />
                                  <span>{target.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="fg-stack">
                            <strong>Escalation targets</strong>
                            <div className="fg-inline-form">
                              {detailOtherTargets.map((target) => (
                                <label key={`escalation-${target.target_key}`}>
                                  <input
                                    type="checkbox"
                                    checked={selectedDraft.escalationTargetKeys.includes(target.target_key)}
                                    onChange={() => toggleTargetReference(selectedTarget.target_key, "escalationTargetKeys", target.target_key)}
                                  />
                                  <span>{target.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : null}

                      {selectedTargetBecomesRiskyDefault ? (
                        <div className="ff-state-block" data-state="blocked">
                          <strong>Premium or OAuth target becomes the default active path</strong>
                          <p>
                            This change would promote a premium-cost or OAuth-backed target into the first active routing slot. Confirm the risk before saving.
                          </p>
                          <label>
                            <input
                              aria-label="Confirm premium or OAuth default warning"
                              type="checkbox"
                              checked={selectedDraft.acknowledgeDefaultRisk}
                              onChange={(event) => updateDraft(selectedTarget.target_key, (current) => ({ ...current, acknowledgeDefaultRisk: event.target.checked }))}
                            />
                            <span>I understand and want this target to become a default active path.</span>
                          </label>
                        </div>
                      ) : null}

                      <div className="fg-actions">
                        <button type="button" onClick={() => void saveSelectedTarget()} disabled={!selectedDraftHasChanges}>
                          Save target changes
                        </button>
                      </div>
                    </section>
                  ) : null}
                </div>
              </DetailPanel>
            ) : (
              <EmptyState
                title="No target selected"
                description="Pick a target row to inspect policy flags, health, priority, queue posture, and runtime readiness."
              />
            )}
          </div>
        </div>
      ) : null}

      {canReadTargets && targets.length > 0 ? (
        <AdvancedDiagnostics
          title="Advanced diagnostics"
          description="Raw target payloads stay collapsed here so the main table and detail panel remain operational."
          status={`${targets.length} targets`}
          statusTone="neutral"
        >
          <pre>{JSON.stringify({ filters: { providerFilter, statusFilter, costClassFilter, qualityTierFilter, capabilityFilter, healthFilter }, selectedTarget }, null, 2)}</pre>
        </AdvancedDiagnostics>
      ) : null}
    </section>
  );
}
