import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";

import type { AdminSessionUser } from "../src/api/domain";

/**
 * Create a fresh QueryClient for use in a single test case.
 * Retries are disabled so rejected mocks surface immediately.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

type RenderOptions = {
  path: string;
  element: ReactElement;
  session?: AdminSessionUser | null;
  sessionReady?: boolean;
  queryClient?: QueryClient;
};

/**
 * Test wrapper that provides all context layers needed by
 * ForgeFrame pages: routing, session, and TanStack Query.
 *
 * Each call creates a fresh QueryClient so tests never share cache state.
 * Pass an existing `queryClient` to pre‑set data before rendering.
 */
export function withAppContext({
  path,
  element,
  session = null,
  sessionReady = true,
  queryClient,
}: RenderOptions) {
  const client = queryClient ?? createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            element={(
              <Outlet
                context={{
                  session,
                  sessionReady,
                  markPasswordRotationComplete: () => undefined,
                  replaceSession: () => undefined,
                }}
              />
            )}
          >
            <Route path="*" element={element} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/**
 * Open a `<details>` element by matching visible summary text.
 * @param root - DOM subtree to search.
 * @param summaryText - Text expected in the details summary.
 * @returns The opened details element.
 * @throws {Error} If no matching details element exists.
 */
export function expandDetailsBySummary(
  root: ParentNode,
  summaryText: string,
): HTMLDetailsElement {
  const details = Array.from(root.querySelectorAll("details")).find((candidate) => (
    candidate.querySelector("summary")?.textContent?.includes(summaryText) ?? false
  ));
  if (!details) {
    throw new Error(`Details summary not found: ${summaryText}`);
  }
  details.open = true;
  details.dispatchEvent(new Event("toggle", { bubbles: true }));
  return details;
}
