import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchProviderTargets, updateProviderTarget } from "../../api/domain/providers";
import {
  getScopedAdminInstanceId,
  sessionCanMutateScopedOrAnyInstance,
  sessionHasScopedOrAnyInstancePermission,
} from "../../app/adminAccess";
import { useAppSession } from "../../app/session";
import { useInstanceCatalog } from "../../app/useInstanceCatalog";
import type { ProviderTargetRecord } from "../../api/domain/providers";

import type { CapabilityFilter, LoadState, TargetDraft, TargetStatusFilter } from "./types";
import {
  arraysEqual,
  capabilityFilterMatches,
  computeReadinessSummary,
  contractStatusForTarget,
  isDefaultEnabledTarget,
  normalizePriority,
  qualityTierOf,
  sortStringValues,
  targetDraftFromRecord,
  targetHasPremiumOrOauthRisk,
} from "./utils";

/**
 * Hook that manages provider targets state: fetching, filtering, drafting, and saving.
 *
 * @param instanceId - The current instance ID from search params.
 * @param searchParams - The current URL search params.
 * @param setSearchParams - The URL search params setter.
 * @returns All provider-targets state and handlers.
 */
export function useProviderTargets(
  instanceId: string | null,
  searchParams: URLSearchParams,
  setSearchParams: (params: URLSearchParams) => void,
) {
  const { session, sessionReady } = useAppSession();
  const scopedInstanceId = getScopedAdminInstanceId(session, instanceId);
  const { instances, loadState: catalogLoadState, error: catalogError, selectedInstance } = useInstanceCatalog(instanceId);

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

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    setMessage("");
    try {
      const payload = await fetchProviderTargets(instanceId);
      setTargets(payload.targets);
      setDrafts(Object.fromEntries(payload.targets.map((t) => [t.target_key, targetDraftFromRecord(t)])));
      setSelectedTargetKey((current) => (
        current && payload.targets.some((t) => t.target_key === current)
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
  }, [instanceId]);

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
  }, [canReadTargets, instanceId, load]);

  const onInstanceChange = useCallback((nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  }, [searchParams, setSearchParams]);

  const providerOptions = useMemo(
    () => Array.from(new Set(targets.map((t) => t.provider_label ?? t.provider))).sort((a, b) => a.localeCompare(b)),
    [targets],
  );
  const costClassOptions = useMemo(
    () => Array.from(new Set(targets.map((t) => t.cost_class))).sort((a, b) => a.localeCompare(b)),
    [targets],
  );
  const qualityTierOptions = useMemo(
    () => Array.from(new Set(targets.map((t) => qualityTierOf(t)))).sort((a, b) => a.localeCompare(b)),
    [targets],
  );
  const healthOptions = useMemo(
    () => Array.from(new Set(targets.map((t) => t.health_status))).sort((a, b) => a.localeCompare(b)),
    [targets],
  );

  // Compute readiness summary
  const readinessSummary = useMemo(() => computeReadinessSummary(targets), [targets]);

  // Filter targets
  const filteredTargets = useMemo(() => {
    return targets.filter((target) => {
      const providerLabel = target.provider_label ?? target.provider;
      return (providerFilter === "all" || providerLabel === providerFilter)
        && (statusFilter === "all" || contractStatusForTarget(target) === statusFilter)
        && (costClassFilter === "all" || target.cost_class === costClassFilter)
        && (qualityTierFilter === "all" || qualityTierOf(target) === qualityTierFilter)
        && capabilityFilterMatches(target, capabilityFilter)
        && (healthFilter === "all" || target.health_status === healthFilter);
    });
  }, [targets, providerFilter, statusFilter, costClassFilter, qualityTierFilter, capabilityFilter, healthFilter]);

  // Keep selection valid
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
    if (!filteredTargets.some((t) => t.target_key === selectedTargetKey)) {
      setSelectedTargetKey(filteredTargets[0].target_key);
    }
  }, [filteredTargets, selectedTargetKey]);

  const selectedTarget = useMemo(
    () => filteredTargets.find((t) => t.target_key === selectedTargetKey)
      ?? targets.find((t) => t.target_key === selectedTargetKey)
      ?? null,
    [filteredTargets, targets, selectedTargetKey],
  );

  const selectedDraft = useMemo(
    () => selectedTarget ? (drafts[selectedTarget.target_key] ?? targetDraftFromRecord(selectedTarget)) : null,
    [selectedTarget, drafts],
  );

  const detailOtherTargets = useMemo(
    () => selectedTarget ? targets.filter((t) => t.target_key !== selectedTarget.target_key) : [],
    [selectedTarget, targets],
  );

  const updateDraft = useCallback((targetKey: string, updater: (current: TargetDraft) => TargetDraft) => {
    setDrafts((current) => {
      const existing = current[targetKey];
      if (existing) {
        return { ...current, [targetKey]: updater(existing) };
      }
      const record = targets.find((t) => t.target_key === targetKey);
      if (record) {
        return { ...current, [targetKey]: updater(targetDraftFromRecord(record)) };
      }
      return current;
    });
  }, [targets]);

  const toggleTargetReference = useCallback(
    (targetKey: string, field: "fallbackTargetKeys" | "escalationTargetKeys", referenceKey: string) => {
      updateDraft(targetKey, (current) => {
        const values = current[field].includes(referenceKey)
          ? current[field].filter((item) => item !== referenceKey)
          : [...current[field], referenceKey];
        return { ...current, [field]: values };
      });
    },
    [updateDraft],
  );

  const selectedDraftHasChanges = useMemo(() => {
    if (!selectedTarget || !selectedDraft) {
      return false;
    }
    return selectedDraft.enabled !== selectedTarget.enabled
      || normalizePriority(selectedDraft.priority, selectedTarget.priority) !== selectedTarget.priority
      || selectedDraft.queueEligible !== selectedTarget.queue_eligible
      || selectedDraft.fallbackAllowed !== selectedTarget.fallback_allowed
      || !arraysEqual(selectedDraft.fallbackTargetKeys, selectedTarget.fallback_target_keys)
      || selectedDraft.escalationAllowed !== selectedTarget.escalation_allowed
      || !arraysEqual(selectedDraft.escalationTargetKeys, selectedTarget.escalation_target_keys);
  }, [selectedTarget, selectedDraft]);

  const selectedTargetBecomesRiskyDefault = useMemo(() => {
    if (!selectedTarget || !selectedDraft || !selectedDraftHasChanges) {
      return false;
    }
    if (!targetHasPremiumOrOauthRisk(selectedTarget) || !selectedDraft.enabled) {
      return false;
    }
    const proposedPriority = normalizePriority(selectedDraft.priority, selectedTarget.priority);
    const otherEnabledPriorities = targets.flatMap((t) => {
      if (t.target_key === selectedTarget.target_key) {
        return [];
      }
      const draft = drafts[t.target_key];
      const enabled = draft ? draft.enabled : t.enabled;
      const priority = draft ? normalizePriority(draft.priority, t.priority) : t.priority;
      return enabled ? [priority] : [];
    });
    const currentIsDefault = isDefaultEnabledTarget(selectedTarget.priority, selectedTarget.enabled, otherEnabledPriorities);
    const proposedIsDefault = isDefaultEnabledTarget(proposedPriority, selectedDraft.enabled, otherEnabledPriorities);
    return !currentIsDefault && proposedIsDefault;
  }, [selectedTarget, selectedDraft, selectedDraftHasChanges, targets, drafts]);

  const saveSelectedTarget = useCallback(async () => {
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
  }, [selectedTarget, selectedDraft, canMutate, selectedTargetBecomesRiskyDefault, instanceId, load]);

  return {
    // State
    targets,
    filteredTargets,
    drafts,
    selectedTarget,
    selectedDraft,
    selectedTargetKey,
    setSelectedTargetKey,
    state,
    error,
    message,
    setError,
    setMessage,
    canReadTargets,
    canMutate,
    readinessSummary,
    detailOtherTargets,
    selectedDraftHasChanges,
    selectedTargetBecomesRiskyDefault,

    // Instance
    instances,
    selectedInstance,
    catalogLoadState,
    catalogError,
    onInstanceChange,

    // Filters
    providerFilter,
    setProviderFilter,
    statusFilter,
    setStatusFilter,
    costClassFilter,
    setCostClassFilter,
    qualityTierFilter,
    setQualityTierFilter,
    capabilityFilter,
    setCapabilityFilter,
    healthFilter,
    setHealthFilter,
    providerOptions,
    costClassOptions,
    qualityTierOptions,
    healthOptions,

    // Actions
    load,
    updateDraft,
    toggleTargetReference,
    saveSelectedTarget,
  };
}
