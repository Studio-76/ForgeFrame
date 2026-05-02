import { startTransition, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  fetchModelRegister,
  syncProviders,
  type AdminModelRegisterRecord,
} from "../../api/admin";
import {
  getScopedAdminInstanceId,
  sessionCanMutateScopedOrAnyInstance,
} from "../../app/adminAccess";
import { useAppSession } from "../../app/session";
import { getInstanceIdFromSearchParams } from "../../app/tenantScope";
import { deriveUsabilityState, modelKey } from "./utils";
import type { LoadState, ModelFilterKey, SyncState } from "./types";

/**
 * Return value of the `useModels()` hook.
 * Provides all state, handlers, and derived data for the Models page.
 */
export interface UseModelsReturn {
  readonly instanceId: string | null;
  readonly models: AdminModelRegisterRecord[];
  readonly filteredModels: AdminModelRegisterRecord[];
  readonly summary: Record<string, number>;
  readonly state: LoadState;
  readonly error: string;
  readonly selectedModel: AdminModelRegisterRecord | null;
  readonly selectedModelKey: string | null;
  readonly searchValue: string;
  readonly providerFilter: string;
  readonly filterKey: ModelFilterKey;
  readonly syncState: SyncState;
  readonly syncMessage: string;
  readonly canMutateProviderDiscovery: boolean;
  readonly providerOptions: string[];
  readonly setSearchValue: (value: string) => void;
  readonly setProviderFilter: (value: string) => void;
  readonly setFilterKey: (key: ModelFilterKey) => void;
  readonly selectModel: (key: string | null) => void;
  readonly onInstanceChange: (nextInstanceId: string | null) => void;
  readonly handleSyncSelectedProvider: () => Promise<void>;
  readonly handleRefresh: () => Promise<void>;
}

/**
 * Master hook for the Models page.
 *
 * Manages session access, URL state, data fetching, filter state, and
 * the provider sync action for the selected model.
 */
export function useModels(): UseModelsReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAppSession();
  const instanceId = getInstanceIdFromSearchParams(searchParams);

  const [models, setModels] = useState<AdminModelRegisterRecord[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [filterKey, setFilterKey] = useState<ModelFilterKey>("all");
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const scopedInstanceId = getScopedAdminInstanceId(session, instanceId);
  const canMutateProviderDiscovery = sessionCanMutateScopedOrAnyInstance(session, scopedInstanceId, "providers.write");

  const load = async () => {
    setState("loading");
    setError("");
    try {
      const payload = await fetchModelRegister(instanceId);
      setModels(payload.models);
      setSummary(payload.summary ?? {});
      setState("success");
    } catch (loadError: unknown) {
      setModels([]);
      setSummary({});
      setState("error");
      setError(loadError instanceof Error ? loadError.message : "Model register could not be loaded.");
    }
  };

  useEffect(() => {
    void load();
  }, [instanceId, refreshNonce]);

  // Auto-select first model when models change
  useEffect(() => {
    if (models.length === 0) {
      setSelectedModelKey(null);
      return;
    }
    if (!selectedModelKey || !models.some((item) => modelKey(item) === selectedModelKey)) {
      setSelectedModelKey(modelKey(models[0]));
    }
  }, [models, selectedModelKey]);

  // Provider options derived from all models
  const providerOptions = useMemo(
    () => ["all", ...Array.from(new Set(models.map((item) => item.provider))).sort()],
    [models],
  );

  // Filtered models
  const filteredModels = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    return models.filter((model) => {
      // Provider filter
      if (providerFilter !== "all" && model.provider !== providerFilter) {
        return false;
      }

      // Usability filter
      if (filterKey !== "all") {
        const usability = deriveUsabilityState(model);
        if (filterKey === "needs_attention") {
          if (
            usability !== "needs_verification" &&
            usability !== "no_routable_target" &&
            usability !== "declaration_only" &&
            usability !== "degraded"
          ) {
            return false;
          }
        } else if (filterKey === "verification_failed") {
          if (model.trust_status !== "verification_failed") {
            return false;
          }
        } else if (filterKey !== usability) {
          return false;
        }
      }

      // Search
      if (!normalizedSearch) {
        return true;
      }
      const haystack = [
        model.display_name,
        model.model_id,
        model.provider,
        model.provider_label,
        model.routing_key,
        model.owned_by,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [filterKey, models, providerFilter, searchValue]);

  // Sync selected model to filtered list
  useEffect(() => {
    if (filteredModels.length === 0) {
      return;
    }
    if (!selectedModelKey || !filteredModels.some((item) => modelKey(item) === selectedModelKey)) {
      setSelectedModelKey(modelKey(filteredModels[0]));
    }
  }, [filteredModels, selectedModelKey]);

  const selectedModel = useMemo(
    () => filteredModels.find((item) => modelKey(item) === selectedModelKey) ?? filteredModels[0] ?? null,
    [filteredModels, selectedModelKey],
  );

  const handleSyncSelectedProvider = async () => {
    if (!selectedModel || !selectedModel.sync.available || !canMutateProviderDiscovery) {
      return;
    }
    setSyncState("submitting");
    setSyncMessage("");
    try {
      const payload = await syncProviders(selectedModel.provider, instanceId);
      setSyncState("success");
      setSyncMessage(`Synced ${payload.synced_providers.join(", ")}.`);
      setRefreshNonce((n) => n + 1);
    } catch (actionError: unknown) {
      setSyncState("error");
      setSyncMessage(actionError instanceof Error ? actionError.message : "Provider model sync failed.");
    }
  };

  const handleRefresh = async () => {
    await load();
  };

  const onInstanceChange = (nextInstanceId: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextInstanceId) {
      nextSearchParams.set("instanceId", nextInstanceId);
    } else {
      nextSearchParams.delete("instanceId");
    }
    startTransition(() => setSearchParams(nextSearchParams));
  };

  const selectModel = (key: string | null) => {
    setSelectedModelKey(key);
  };

  return {
    instanceId,
    models,
    filteredModels,
    summary,
    state,
    error,
    selectedModel,
    selectedModelKey,
    searchValue,
    providerFilter,
    filterKey,
    syncState,
    syncMessage,
    canMutateProviderDiscovery,
    providerOptions,
    setSearchValue,
    setProviderFilter,
    setFilterKey,
    selectModel,
    onInstanceChange,
    handleSyncSelectedProvider,
    handleRefresh,
  };
}
