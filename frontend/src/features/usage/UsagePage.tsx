import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  fetchClientDrilldown,
  fetchProviderDrilldown,
  fetchUsageSummary,
  type UsageSummaryFilters,
  type UsageSummaryResponse,
} from "../../api/domain";
import { useAppSession } from "../../app/session";
import { getInstanceIdFromSearchParams } from "../../app/tenantScope";
import { useInstanceCatalog } from "../../app/useInstanceCatalog";
import { InstanceScopeCard } from "../../components/InstanceScopeCard";
import { PageIntro } from "../../components/PageIntro";
import {
  describeFreshness,
  formatMetric,
  formatPercent,
  formatTimestamp,
  getLatestEvidenceTimestamp,
  getUsageAccess,
  toStringValue,
  WINDOW_LABELS,
  WINDOW_OPTIONS,
  type LoadState,
  type UsageWindow,
} from "./helpers";
import { UsageContent } from "./sections";

function hasSelectedFilters(filters: UsageSummaryFilters): boolean {
  return Boolean(filters.provider || filters.clientId || filters.model);
}

function isUsageEmpty(summary: UsageSummaryResponse | null): boolean {
  if (!summary) {
    return false;
  }
  return (
    (summary.metrics.recorded_request_count ?? 0) === 0 &&
    (summary.metrics.recorded_error_count ?? 0) === 0 &&
    (summary.metrics.recorded_health_event_count ?? 0) === 0
  );
}

function normalizeWindowParam(value: string | null): UsageWindow {
  if (value === "1h" || value === "24h" || value === "7d" || value === "all") {
    return value;
  }
  return "24h";
}

function normalizeSearchValue(value: string | null): string {
  return (value ?? "").trim();
}

export function UsagePage() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [partialMessages, setPartialMessages] = useState<string[]>([]);
  const [summary, setSummary] = useState<UsageSummaryResponse | null>(null);
  const [catalog, setCatalog] = useState<UsageSummaryResponse | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const [window, setWindow] = useState<UsageWindow>(() => normalizeWindowParam(searchParams.get("usageWindow")));
  const [providerFilter, setProviderFilter] = useState(() => normalizeSearchValue(searchParams.get("provider")));
  const [clientFilter, setClientFilter] = useState(() => normalizeSearchValue(searchParams.get("client")));
  const [modelFilter, setModelFilter] = useState(() => normalizeSearchValue(searchParams.get("model")));
  const [providerDrilldown, setProviderDrilldown] = useState<Record<string, unknown> | null>(null);
  const [providerDrilldownState, setProviderDrilldownState] = useState<LoadState>("idle");
  const [providerDrilldownError, setProviderDrilldownError] = useState<string | null>(null);
  const [clientDrilldown, setClientDrilldown] = useState<Record<string, unknown> | null>(null);
  const [clientDrilldownState, setClientDrilldownState] = useState<LoadState>("idle");
  const [clientDrilldownError, setClientDrilldownError] = useState<string | null>(null);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);

  const access = getUsageAccess(session, sessionReady);
  const filters = useMemo<UsageSummaryFilters>(() => ({
    provider: providerFilter || null,
    clientId: clientFilter || null,
    model: modelFilter || null,
  }), [clientFilter, modelFilter, providerFilter]);
  const filtersActive = hasSelectedFilters(filters);
  const latestEvidenceAt = getLatestEvidenceTimestamp(summary);
  const freshness = describeFreshness(window, latestEvidenceAt);
  const emptyUsage = isUsageEmpty(summary);

  const updateUsageSearchParams = (updates: {
    usageWindow?: UsageWindow | null;
    provider?: string | null;
    client?: string | null;
    model?: string | null;
    instanceId?: string | null;
  }) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    const entries = Object.entries(updates);
    entries.forEach(([key, value]) => {
      if (value && value.trim().length > 0) {
        nextSearchParams.set(key, value);
      } else {
        nextSearchParams.delete(key);
      }
    });
    setSearchParams(nextSearchParams);
  };

  const onInstanceChange = (nextInstanceId: string | null) => {
    updateUsageSearchParams({ instanceId: nextInstanceId });
  };

  useEffect(() => {
    setWindow((current) => {
      const nextValue = normalizeWindowParam(searchParams.get("usageWindow"));
      return current === nextValue ? current : nextValue;
    });
    setProviderFilter((current) => {
      const nextValue = normalizeSearchValue(searchParams.get("provider"));
      return current === nextValue ? current : nextValue;
    });
    setClientFilter((current) => {
      const nextValue = normalizeSearchValue(searchParams.get("client"));
      return current === nextValue ? current : nextValue;
    });
    setModelFilter((current) => {
      const nextValue = normalizeSearchValue(searchParams.get("model"));
      return current === nextValue ? current : nextValue;
    });
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setState("loading");
      setError(null);
      setPartialMessages([]);
      setSummary(null);

      const summaryPromise = filtersActive
        ? fetchUsageSummary(window, instanceId, filters)
        : fetchUsageSummary(window, instanceId);
      const catalogPromise = filtersActive ? fetchUsageSummary(window, instanceId) : null;

      const [summaryResult, catalogResult] = await Promise.allSettled([
        summaryPromise,
        ...(catalogPromise ? [catalogPromise] : []),
      ]);

      if (!mounted) {
        return;
      }

      const nextPartialMessages: string[] = [];

      if (summaryResult.status !== "fulfilled") {
        setSummary(null);
        setCatalog(null);
        setState("error");
        setError(summaryResult.reason instanceof Error ? summaryResult.reason.message : "Usage analysis loading failed.");
        return;
      }

      const nextSummary = summaryResult.value;
      const nextCatalog = catalogResult?.status === "fulfilled" ? catalogResult.value : nextSummary;
      if (catalogResult?.status === "rejected") {
        const message = catalogResult.reason instanceof Error ? catalogResult.reason.message : "Filter option catalog loading failed.";
        nextPartialMessages.push(`Filter catalog unavailable: ${message}`);
      }

      setSummary(nextSummary);
      setCatalog(nextCatalog);
      setPartialMessages(nextPartialMessages);
      setState("success");
      setError(null);
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [filters, filtersActive, instanceId, window]);

  const providerOptions = (catalog?.aggregations.by_provider ?? [])
    .map((item) => toStringValue(item.provider, ""))
    .filter((value) => value.length > 0);
  const clientOptions = (catalog?.aggregations.by_client ?? [])
    .map((item) => toStringValue(item.client_id, ""))
    .filter((value) => value.length > 0);
  const modelOptions = (catalog?.aggregations.by_model ?? [])
    .map((item) => toStringValue(item.model, ""))
    .filter((value) => value.length > 0);

  useEffect(() => {
    if (providerFilter && !providerOptions.includes(providerFilter)) {
      updateUsageSearchParams({ provider: null });
    }
  }, [providerFilter, providerOptions, searchParams]);

  useEffect(() => {
    if (clientFilter && !clientOptions.includes(clientFilter)) {
      updateUsageSearchParams({ client: null });
    }
  }, [clientFilter, clientOptions, searchParams]);

  useEffect(() => {
    if (modelFilter && !modelOptions.includes(modelFilter)) {
      updateUsageSearchParams({ model: null });
    }
  }, [modelFilter, modelOptions, searchParams]);

  useEffect(() => {
    let mounted = true;

    if (!providerFilter) {
      setProviderDrilldown(null);
      setProviderDrilldownState("idle");
      setProviderDrilldownError(null);
      return () => {
        mounted = false;
      };
    }

    setProviderDrilldownState("loading");
    setProviderDrilldownError(null);
    void fetchProviderDrilldown(providerFilter, window, instanceId)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setProviderDrilldown(payload.drilldown);
        setProviderDrilldownState("success");
      })
      .catch((loadError) => {
        if (!mounted) {
          return;
        }
        setProviderDrilldown(null);
        setProviderDrilldownState("error");
        setProviderDrilldownError(loadError instanceof Error ? loadError.message : "Provider drilldown loading failed.");
      });

    return () => {
      mounted = false;
    };
  }, [instanceId, providerFilter, window]);

  useEffect(() => {
    let mounted = true;

    if (!clientFilter) {
      setClientDrilldown(null);
      setClientDrilldownState("idle");
      setClientDrilldownError(null);
      return () => {
        mounted = false;
      };
    }

    setClientDrilldownState("loading");
    setClientDrilldownError(null);
    void fetchClientDrilldown(clientFilter, window, instanceId)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setClientDrilldown(payload.drilldown);
        setClientDrilldownState("success");
      })
      .catch((loadError) => {
        if (!mounted) {
          return;
        }
        setClientDrilldown(null);
        setClientDrilldownState("error");
        setClientDrilldownError(loadError instanceof Error ? loadError.message : "Client drilldown loading failed.");
      });

    return () => {
      mounted = false;
    };
  }, [clientFilter, instanceId, window]);

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Usage Analysis"
        description="Inspect traffic volume, runtime pressure, provider hotspots, and client concentration without turning this route into the budget-control or incident-review surface."
        question="Which traffic pattern is growing, failing, or concentrating enough to justify a jump to Costs or Errors?"
        badges={[
          { label: access.badgeLabel, tone: access.badgeTone },
          { label: freshness.label, tone: freshness.tone },
          ...(selectedInstance ? [{ label: `Instance scope: ${selectedInstance.display_name}`, tone: "success" as const }] : []),
        ]}
        note={`${access.summaryDetail} Costs stays the place for budget control, and Errors stays the place for incident review.`}
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="usage analysis"
        onInstanceChange={onInstanceChange}
      />

      <UsageContent
        access={access}
        state={state}
        error={error}
        partialMessages={partialMessages}
        summary={summary}
        emptyUsage={emptyUsage}
        latestEvidenceAt={latestEvidenceAt}
        freshness={freshness}
        instanceId={instanceId}
        window={window}
        windowLabels={WINDOW_LABELS}
        windowOptions={WINDOW_OPTIONS}
        providerFilter={providerFilter}
        providerOptions={providerOptions}
        clientFilter={clientFilter}
        clientOptions={clientOptions}
        modelFilter={modelFilter}
        modelOptions={modelOptions}
        providerDrilldown={providerDrilldown}
        providerDrilldownState={providerDrilldownState}
        providerDrilldownError={providerDrilldownError}
        clientDrilldown={clientDrilldown}
        clientDrilldownState={clientDrilldownState}
        clientDrilldownError={clientDrilldownError}
        onWindowChange={(nextWindow) => updateUsageSearchParams({ usageWindow: nextWindow })}
        onProviderFilterChange={(nextProvider) => updateUsageSearchParams({ provider: nextProvider || null, client: null })}
        onClientFilterChange={(nextClient) => updateUsageSearchParams({ client: nextClient || null, provider: null })}
        onModelFilterChange={(nextModel) => updateUsageSearchParams({ model: nextModel || null })}
        onResetFilters={() => updateUsageSearchParams({ provider: null, client: null, model: null })}
        formatMetric={formatMetric}
        formatPercent={formatPercent}
        formatTimestamp={formatTimestamp}
      />
    </section>
  );
}
