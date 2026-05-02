// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteErrorBoundaryView } from "../src/app/RouteErrorBoundary";

let shouldThrow = true;

/**
 * Throws during render while test state requires a failure.
 * @returns Stable content when failures are disabled.
 * @throws {Error} When `shouldThrow` is true.
 */
function CrashableRoute() {
  if (shouldThrow) {
    throw new Error("intentional route crash");
  }

  return <p>Recovered route payload</p>;
}

/**
 * Mount a React element into a jsdom host.
 * @param element - Node tree to render.
 * @returns Mounted root and host container.
 */
async function renderIntoDom(element: React.ReactNode) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(element);
  });

  return { host, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  shouldThrow = true;
});

describe("route error boundary", () => {
  it("shows fallback controls and recovers when retry succeeds", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { host } = await renderIntoDom(
      <MemoryRouter initialEntries={["/crash"]}>
        <RouteErrorBoundaryView>
          <CrashableRoute />
        </RouteErrorBoundaryView>
      </MemoryRouter>,
    );

    expect(host.textContent).toContain("Module Recovery Required");
    expect(host.textContent).toContain("Retry module");

    shouldThrow = false;
    const retryButton = host.querySelector("button");

    await act(async () => {
      retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(host.textContent).toContain("Recovered route payload");
    consoleSpy.mockRestore();
  });
});
