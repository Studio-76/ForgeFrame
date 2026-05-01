import { useMemo } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { adminKeys, useInstancesQuery } from "../api/adminQueries";
import { fetchInstances } from "../api/admin";
import type { InstanceRecord } from "../api/admin";

export type InstanceCatalogLoadState = "idle" | "loading" | "success" | "error";

export function useInstanceCatalog(instanceId: string | null) {
  const queryClient = useQueryClient();
  const { data: instances, isLoading, isSuccess, isError, error } = useInstancesQuery();

  const loadState: InstanceCatalogLoadState = isLoading
    ? "loading"
    : isError
      ? "error"
      : isSuccess
        ? "success"
        : "idle";

  const selectedInstance = useMemo(() => {
    const list = instances ?? [];
    if (instanceId) {
      return list.find((item) => item.instance_id === instanceId) ?? null;
    }
    return list.find((item) => item.is_default) ?? list[0] ?? null;
  }, [instanceId, instances]);

  /**
   * Re-fetch the instance inventory and update the TanStack Query cache
   * directly so that the result is available on the next React render
   * without waiting for the async query observer to settle.
   */
  const refresh = async () => {
    const payload = await fetchInstances();
    queryClient.setQueryData(adminKeys.instances, payload);
    return payload.instances;
  };

  return {
    instances: instances ?? [],
    loadState,
    error: error instanceof Error ? error.message : "",
    selectedInstance,
    refresh,
  };
}
