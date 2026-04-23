import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchInstances, type InstanceRecord } from "../api/admin";

export type InstanceCatalogLoadState = "idle" | "loading" | "success" | "error";

export function useInstanceCatalog(instanceId: string | null) {
  const [instances, setInstances] = useState<InstanceRecord[]>([]);
  const [loadState, setLoadState] = useState<InstanceCatalogLoadState>("idle");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoadState("loading");
    setError("");
    try {
      const payload = await fetchInstances();
      setInstances(payload.instances);
      setLoadState("success");
      return payload.instances;
    } catch (loadError) {
      setInstances([]);
      setLoadState("error");
      setError(loadError instanceof Error ? loadError.message : "Instance inventory could not be loaded.");
      throw loadError;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setError("");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setInstances(payload.instances);
        setLoadState("success");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setInstances([]);
        setLoadState("error");
        setError(loadError instanceof Error ? loadError.message : "Instance inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedInstance = useMemo(() => {
    if (instanceId) {
      return instances.find((item) => item.instance_id === instanceId) ?? null;
    }
    return instances.find((item) => item.is_default) ?? instances[0] ?? null;
  }, [instanceId, instances]);

  return {
    instances,
    loadState,
    error,
    selectedInstance,
    refresh,
  };
}
