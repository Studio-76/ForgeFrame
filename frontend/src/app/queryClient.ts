import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient for the ForgeFrame control plane.
 * Configured with conservative caching defaults — data is
 * kept fresh for 30 s and stale data is never auto‑fetched
 * until the window regains focus.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});
