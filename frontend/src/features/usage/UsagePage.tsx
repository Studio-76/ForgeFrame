import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  fetchClientDrilldown,
  fetchClientOperationalView,
  fetchProviderDrilldown,
  fetchUsageSummary,
  type UsageSummaryResponse,
} from "../../api/admin";
import { CONTROL_PLANE_ROUTES } from "../../app/navigation";
import { useAppSession } from "../../app/session";
import { getInstanceIdFromSearchParams } from "../../app/tenantScope";
import { useInstanceCatalog } from "../../app/useInstanceCatalog";
import { InstanceScopeCard } from "../../components/InstanceScopeCard";
import { PageIntro } from "../../components/PageIntro";
import {
  asRecordArray,
  describeFreshness,
  formatMetric,
  formatPercent,
  formatTimestamp,
  getAttentionClients,
  getLatestEvidenceTimestamp,
  getRecommendedRoute,
  getUsageAccess,
  isUsageEmpty,
  toStringValue,
  WINDOW_LABELS,
  WINDOW_OPTIONS,
  type LoadState,
  type UsageWindow,
} from "./helpers";
import { UsageContent } from "./sections";

export function UsagePage() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [partialMessages, setPartialMessages] = useState<string[]>([]);
  const [summary, setSummary] = useState<UsageSummaryResponse | null>(null);
  const [window, setWindow] = useState<UsageWindow>("24h");
  const [clientOps, setClientOps] = useState<Array<Record<string, string | number | boolean>>>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [providerDrilldown, setProviderDrilldown] = useState<Record<string, unknown> | null>(null);
  const [providerDrilldownState, setProviderDrilldownState] = useState<LoadState>("idle");
  const [providerDrilldownError, setProviderDrilldownError] = useState<string | null>(null);
  const [clientDrilldown, setClientDrilldown] = useState<Record<string, unknown> | null>(null);
  const [clientDrilldownState, setClientDrilldownState] = useState<LoadState>("idle");
  const [clientDrilldownError, setClientDrilldownError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, sessionReady } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);
  const { instances, loadState, error: instancesError, selectedInstance } = useInstanceCatalog(instanceId);

  const access = getUsageAccess(session, sessionReady);
  const latestEvidenceAt = getLatestEvidenceTimestamp(summary);
  const freshness = describeFreshness(window, latestEvidenceAt);
  const emptyUsage = isUsageEmpty(summary, clientOps);
  const attentionClients = getAttentionClients(clientOps);
  const recommendation = summary ? getRecommendedRoute(summary, clientOps) : null;
  const providerModels = asRecordArray(providerDrilldown?.models);
  const providerClients = asRecordArray(providerDrilldown?.clients);
  const providerHealth = asRecordArray(providerDrilldown?.latest_health);
  const clientProviders = asRecordArray(clientDrilldown?.providers);
  const clientErrors = asRecordArray(clientDrilldown?.recent_errors);
  const clientUsage = asRecordArray(clientDrilldown?.recent_usage);

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    setSearchParams(nextSearchParams);
  };

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setState("loading");
      setError(null);
      setPartialMessages([]);
      setSummary(null);
      setClientOps([]);
      setProviderDrilldown(null);
      setProviderDrilldownState("idle");
      setProviderDrilldownError(null);
      setClientDrilldown(null);
      setClientDrilldownState("idle");
      setClientDrilldownError(null);

      const [summaryResult, clientOpsResult] = await Promise.allSettled([
        fetchUsageSummary(window, instanceId),
        fetchClientOperationalView(window, instanceId),
      ]);

      if (!mounted) {
        return;
      }

      const nextPartialMessages: string[] = [];
      let nextSummary: UsageSummaryResponse | null = null;
      let nextClients: Array<Record<string, string | number | boolean>> = [];
      let nextError: string | null = null;

      if (summaryResult.status === "fulfilled") {
        nextSummary = summaryResult.value;
      } else {
        const message = summaryResult.reason instanceof Error ? summaryResult.reason.message : "Usage summary loading failed.";
        nextPartialMessages.push(`Summary monitoring is unavailable: ${message}`);
        nextError = message;
      }

      if (clientOpsResult.status === "fulfilled") {
        nextClients = clientOpsResult.value.clients;
      } else {
        const message = clientOpsResult.reason instanceof Error ? clientOpsResult.reason.message : "Client operational view loading failed.";
        nextPartialMessages.push(`Client hotspot ranking is unavailable: ${message}`);
        if (!nextError) {
          nextError = message;
        }
      }

      setSummary(nextSummary);
      setClientOps(nextClients);
      setPartialMessages(nextPartialMessages);

      if (nextSummary) {
        const providerOptions = nextSummary.aggregations.by_provider.map((item) => toStringValue(item.provider, ""));
        setSelectedProvider((current) => (current && providerOptions.includes(current) ? current : (providerOptions[0] ?? "")));
      } else {
        setSelectedProvider("");
      }

      if (nextClients.length > 0) {
        const clientOptions = nextClients.map((item) => toStringValue(item.client_id, ""));
        setSelectedClient((current) => (current && clientOptions.includes(current) ? current : (clientOptions[0] ?? "")));
      } else {
        setSelectedClient("");
      }

      if (nextSummary || nextClients.length > 0) {
        setState("success");
        setError(nextSummary ? null : nextError);
        return;
      }

      setState("error");
      setError(nextError ?? "Usage drilldown loading failed.");
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [instanceId, window]);

  useEffect(() => {
    let mounted = true;

    if (!summary || !selectedProvider) {
      setProviderDrilldown(null);
      setProviderDrilldownState("idle");
      setProviderDrilldownError(null);
      return () => {
        mounted = false;
      };
    }

    setProviderDrilldownState("loading");
    setProviderDrilldownError(null);

    void fetchProviderDrilldown(selectedProvider, window, instanceId)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setProviderDrilldown(payload.drilldown);
        setProviderDrilldownState("success");
      })
      .catch((err) => {
        if (!mounted) {
          return;
        }
        setProviderDrilldown(null);
        setProviderDrilldownState("error");
        setProviderDrilldownError(err instanceof Error ? err.message : "Provider drilldown loading failed.");
      });

    return () => {
      mounted = false;
    };
  }, [instanceId, selectedProvider, summary, window]);

  useEffect(() => {
    let mounted = true;

    if (!selectedClient) {
      setClientDrilldown(null);
      setClientDrilldownState("idle");
      setClientDrilldownError(null);
      return () => {
        mounted = false;
      };
    }

    setClientDrilldownState("loading");
    setClientDrilldownError(null);

    void fetchClientDrilldown(selectedClient, window, instanceId)
      .then((payload) => {
        if (!mounted) {
          return;
        }
        setClientDrilldown(payload.drilldown);
        setClientDrilldownState("success");
      })
      .catch((err) => {
        if (!mounted) {
          return;
        }
        setClientDrilldown(null);
        setClientDrilldownState("error");
        setClientDrilldownError(err instanceof Error ? err.message : "Client drilldown loading failed.");
      });

    return () => {
      mounted = false;
    };
  }, [instanceId, selectedClient, window]);

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Operations"
        title="Usage & Cost Operations Drilldown"
        description="Historical traffic, cost pressure, and provider/client hotspot evidence separated from the live provider and incident routes."
        question="What needs operational attention?"
        links={[
          {
            label: "Usage Overview",
            to: CONTROL_PLANE_ROUTES.usage,
            description: "Start with the summary monitoring surface and evidence freshness.",
          },
          {
            label: "Provider Health & Runs",
            to: CONTROL_PLANE_ROUTES.providerHealthRuns,
            description: "Use the live provider route when the signal looks provider-wide or readiness-related.",
          },
          {
            label: "Errors & Activity",
            to: CONTROL_PLANE_ROUTES.logs,
            description: "Switch to incident shape, recent failures, and audit-adjacent activity when usage evidence points to a runtime problem.",
          },
          {
            label: "Client Investigation",
            to: `${CONTROL_PLANE_ROUTES.usage}#client-investigation`,
            description: "Stay on this route when the next question is client blast radius or cost concentration.",
          },
        ]}
        badges={[
          { label: access.badgeLabel, tone: access.badgeTone },
          { label: freshness.label, tone: freshness.tone },
          ...(selectedInstance ? [{ label: `Instance scope: ${selectedInstance.display_name}`, tone: "success" as const }] : []),
        ]}
        note={`${access.summaryDetail} Runtime truth stays adjacent on Provider Health & Runs, while this page remains the historical monitoring drilldown.`}
      />

      <InstanceScopeCard
        instanceId={instanceId}
        selectedInstance={selectedInstance}
        instances={instances}
        loadState={loadState}
        error={instancesError}
        surfaceLabel="usage and cost evidence"
        onInstanceChange={onInstanceChange}
      />

      <UsageContent
        access={access}
        window={window}
        windowLabels={WINDOW_LABELS}
        windowOptions={WINDOW_OPTIONS}
        state={state}
        error={error}
        partialMessages={partialMessages}
        summary={summary}
        recommendation={recommendation}
        freshness={freshness}
        latestEvidenceAt={latestEvidenceAt}
        attentionClients={attentionClients}
        emptyUsage={emptyUsage}
        selectedProvider={selectedProvider}
        providerDrilldownState={providerDrilldownState}
        providerDrilldownError={providerDrilldownError}
        providerDrilldown={providerDrilldown}
        providerModels={providerModels}
        providerClients={providerClients}
        providerHealth={providerHealth}
        selectedClient={selectedClient}
        clientDrilldownState={clientDrilldownState}
        clientDrilldownError={clientDrilldownError}
        clientDrilldown={clientDrilldown}
        clientOps={clientOps}
        clientProviders={clientProviders}
        clientErrors={clientErrors}
        clientUsage={clientUsage}
        instanceId={instanceId}
        onWindowChange={setWindow}
        onSelectedProviderChange={setSelectedProvider}
        onSelectedClientChange={setSelectedClient}
        formatMetric={formatMetric}
        formatPercent={formatPercent}
        formatTimestamp={formatTimestamp}
        toStringValue={toStringValue}
      />
    </section>
  );
}
