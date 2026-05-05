import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient for the ForgeFrame control plane.
 *
 * Defaults are tuned for an operational UI where:
 * - Most list/dashboard data stays fresh for 2 minutes.
 * - Stale data is silently refetched on window focus (user may have
 *   switched tabs to check another surface).
 * - Failed queries retry once after a short delay.
 * - Unused cache entries expire after 10 minutes (longer than the default
 *   5 min because operators may tab between pages slowly).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10_000),
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  },
});
