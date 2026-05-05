/**
 * useInstanceScope — convenience hook combining Zustand scope store with URL
 * search param updates.
 *
 * Reads the current instance scope from the store and provides a setter that
 * updates both the store and the URL simultaneously, keeping them in sync.
 *
 * Pages should use this hook instead of independently parsing URL params.
 *
 * @module
 */

import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

import { useScopeStore } from "../store";
import { INSTANCE_ID_QUERY_PARAM, withInstanceScope } from "../app/tenantScope";

/**
 * Result of the useInstanceScope hook.
 */
export type InstanceScopeResult = {
  /** The currently selected instance ID, or null. */
  instanceId: string | null;

  /** Human-readable scope label. */
  scopeLabel: string;

  /**
   * Change the scope to a new instance.
   * Updates both the Zustand store and the URL search params.
   * @param nextInstanceId - New instance ID, or null to clear scope.
   */
  setInstanceScope: (nextInstanceId: string | null) => void;

  /**
   * Build a URL path with the current instance scope preserved.
   * Uses the existing withInstanceScope utility from tenantScope.
   */
  scopedPath: (to: string) => string;
};

/**
 * Read and set the current instance scope.
 *
 * Combines Zustand's useScopeStore with URL search param updates so that
 * the scope change is reflected both in shared state and in the address bar.
 *
 * @example
 * ```tsx
 * const { instanceId, scopeLabel, setInstanceScope } = useInstanceScope();
 *
 * // Read scope
 * if (instanceId) { ... }
 *
 * // Set scope (updates store + URL)
 * setInstanceScope("inst-abc123");
 * ```
 */
export function useInstanceScope(): InstanceScopeResult {
  const instanceId = useScopeStore((s) => s.instanceId);
  const scopeLabel = useScopeStore((s) => s.scopeLabel);
  const setScope = useScopeStore((s) => s.setScope);
  const [searchParams, setSearchParams] = useSearchParams();

  const setInstanceScope = useCallback(
    (nextInstanceId: string | null) => {
      setScope(nextInstanceId);

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (nextInstanceId) {
            next.set(INSTANCE_ID_QUERY_PARAM, nextInstanceId);
          } else {
            next.delete(INSTANCE_ID_QUERY_PARAM);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setScope, setSearchParams],
  );

  const scopedPath = useCallback(
    (to: string) => withInstanceScope(to, instanceId),
    [instanceId],
  );

  return { instanceId, scopeLabel, setInstanceScope, scopedPath };
}
