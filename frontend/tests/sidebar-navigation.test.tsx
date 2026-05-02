// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AdminSessionUser } from "../src/api/admin";
import { getControlPlaneNavigation } from "../src/app/navigation";
import { AppSidebar } from "../src/components/layout/AppSidebar";
import { SidebarProvider, useSidebar } from "../src/components/layout/SidebarContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const adminSession: AdminSessionUser = {
  session_id: "session-1",
  user_id: "user-1",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

const viewerSession: AdminSessionUser = {
  session_id: "session-viewer",
  user_id: "user-viewer",
  username: "viewer",
  display_name: "Viewer",
  role: "viewer",
};

let container: HTMLDivElement;
let root: Root | null = null;

function MobileSidebarToggleHarness() {
  const { toggleMobileSidebar } = useSidebar();

  return (
    <button type="button" onClick={toggleMobileSidebar} aria-label="Toggle mobile sidebar test harness">
      Toggle Mobile Sidebar
    </button>
  );
}

function SidebarToggleHarness() {
  const { toggleSidebar, isExpanded } = useSidebar();

  return (
    <button type="button" onClick={toggleSidebar} aria-label="Toggle sidebar expand">
      {isExpanded ? "Collapse" : "Expand"}
    </button>
  );
}

async function renderSidebar(path: string, session: AdminSessionUser = adminSession) {
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[path]}>
        <SidebarProvider>
          <MobileSidebarToggleHarness />
          <SidebarToggleHarness />
          <AppSidebar navigationSections={getControlPlaneNavigation(session)} instanceId={null} />
        </SidebarProvider>
      </MemoryRouter>,
    );
  });
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function flushAnimationFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
    writable: true,
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
  window.localStorage.clear();
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1280,
    writable: true,
  });
});

afterEach(() => {
  if (!root) {
    return;
  }

  act(() => {
    root?.unmount();
  });
  root = null;
});

describe("sidebar navigation shell", () => {
  it("starts expanded and toggles a section open/closed on trigger click", async () => {
    await renderSidebar("/dashboard");
    await flushEffects();

    const aside = container.querySelector<HTMLElement>("#ff-sidebar");
    const setupTrigger = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label") === "Setup section",
    );
    const setupLinks = container.querySelector<HTMLElement>("#ff-sidebar-section-setup");

    // Sidebar starts expanded by default
    expect(aside?.className).toContain("is-open");
    // Section starts collapsed
    expect(setupTrigger?.getAttribute("aria-expanded")).toBe("false");
    expect(setupLinks?.hidden).toBe(true);
    expect(setupLinks?.textContent).not.toContain("Setup progress");
    expect(container.querySelector<HTMLAnchorElement>('#ff-sidebar-section-setup a[href="/instances"]')).toBeNull();

    // Click trigger to expand the section
    await act(async () => {
      setupTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(setupTrigger?.getAttribute("aria-expanded")).toBe("true");
    expect(setupLinks?.hidden).toBe(false);
    expect(setupLinks?.textContent).toContain("Setup progress");
    expect(container.querySelector<HTMLAnchorElement>('#ff-sidebar-section-setup a[href="/instances"]')).not.toBeNull();
    expect(aside?.className).toContain("is-open");
    expect(window.localStorage.getItem("forgeframe.sidebar.sections")).toContain('"setup":true');

    // Click trigger again to collapse the section
    await act(async () => {
      setupTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(setupTrigger?.getAttribute("aria-expanded")).toBe("false");
    expect(setupLinks?.hidden).toBe(true);
    expect(setupLinks?.textContent).not.toContain("Setup progress");
    expect(container.querySelector<HTMLAnchorElement>('#ff-sidebar-section-setup a[href="/instances"]')).toBeNull();
    expect(window.localStorage.getItem("forgeframe.sidebar.sections")).toContain('"setup":false');
  });

  it("does not reopen the active section after a manual collapse", async () => {
    await renderSidebar("/instances");
    await flushEffects();
    await flushEffects();

    const setupSection = container.querySelector<HTMLElement>(".ff-sidebar-section.is-current");
    const setupTrigger = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label") === "Setup section",
    );
    const setupLinks = container.querySelector<HTMLElement>("#ff-sidebar-section-setup");

    expect(setupTrigger?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector<HTMLAnchorElement>('#ff-sidebar-section-setup a[aria-current="page"]')?.textContent).toContain(
      "Instances",
    );

    await act(async () => {
      setupTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();
    await flushEffects();

    expect(setupTrigger?.getAttribute("aria-expanded")).toBe("false");
    expect(setupLinks?.hidden).toBe(true);
    expect(container.querySelector<HTMLAnchorElement>('#ff-sidebar-section-setup a[aria-current="page"]')).toBeNull();
    expect(setupSection?.className).toContain("is-current");
    expect(setupTrigger?.className).toContain("is-current");
  });

  it("keeps the active section open even when persisted section state says closed", async () => {
    window.localStorage.setItem("forgeframe.sidebar.expanded", "true");
    window.localStorage.setItem("forgeframe.sidebar.sections", JSON.stringify({ runtime: false }));

    await renderSidebar("/usage");
    await flushEffects();
    // Second flush: the auto-open useEffect fires during initial render,
    // calling openSection() which updates context state. The state
    // propagation needs an extra render cycle to reach AppSidebar.
    await flushEffects();

    const runtimeTrigger = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label") === "Runtime section",
    );
    const currentLink = container.querySelector<HTMLAnchorElement>('a[aria-current="page"]');

    expect(runtimeTrigger?.getAttribute("aria-expanded")).toBe("true");
    expect(currentLink?.getAttribute("href")).toBe("/usage");
    expect(currentLink?.textContent).toContain("Usage");
  });

  it("keeps a permission-limited current route visible inside its open group", async () => {
    await renderSidebar("/approvals", viewerSession);
    await flushEffects();

    const aside = container.querySelector<HTMLElement>("#ff-sidebar");
    const governanceTrigger = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label") === "Governance section",
    );
    const governanceLinks = container.querySelector<HTMLElement>("#ff-sidebar-section-governance");
    const currentDisabledLink = Array.from(container.querySelectorAll<HTMLElement>('[role="link"][aria-disabled="true"]')).find(
      (element) => element.textContent?.includes("Approvals"),
    );

    // Sidebar starts expanded
    expect(aside?.className).toContain("is-open");
    // Governance section should be open (auto-opened due to active match)
    expect(governanceTrigger?.getAttribute("aria-expanded")).toBe("true");
    expect(governanceLinks?.hidden).toBe(false);
    expect(currentDisabledLink).not.toBeNull();
    expect(currentDisabledLink?.textContent).toContain("Operator or admin");
  });

  it("opens a mobile overlay sidebar and renders the backdrop", async () => {
    setViewportWidth(375);
    await renderSidebar("/dashboard");
    await flushAnimationFrame();

    const toggleButton = container.querySelector<HTMLButtonElement>('button[aria-label="Toggle mobile sidebar test harness"]');
    expect(toggleButton).not.toBeNull();

    await act(async () => {
      toggleButton?.click();
    });

    const sidebar = container.querySelector<HTMLElement>("#ff-sidebar");
    const backdrop = container.querySelector<HTMLButtonElement>(".ff-backdrop");

    expect(sidebar?.className).toContain("is-mobile-open");
    expect(backdrop).not.toBeNull();
  });

  it("shows rail links when sidebar is collapsed on desktop", async () => {
    await renderSidebar("/dashboard");
    await flushEffects();

    // Sidebar starts expanded; collapse it
    const collapseButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label") === "Toggle sidebar expand",
    );
    expect(collapseButton).not.toBeNull();

    await act(async () => {
      collapseButton?.click();
    });
    await flushEffects();

    const aside = container.querySelector<HTMLElement>("#ff-sidebar");
    expect(aside?.className).toContain("is-collapsed");

    // Rail link buttons should exist for each section
    const railLinks = container.querySelectorAll<HTMLButtonElement>(".ff-sidebar-rail-link");
    expect(railLinks.length).toBeGreaterThanOrEqual(8); // All 8 sections have icons

    // The active section's rail link should have the is-current class
    const currentRailLink = container.querySelector<HTMLButtonElement>(".ff-sidebar-rail-link.is-current");
    expect(currentRailLink).not.toBeNull();

    // Rail links should have aria-labels (tooltips)
    const firstRailLink = railLinks[0];
    expect(firstRailLink?.getAttribute("aria-label")).toBeTruthy();
    expect(firstRailLink?.getAttribute("data-tooltip")).toBeTruthy();
  });

  it("expands sidebar and opens section when clicking rail link in collapsed mode", async () => {
    await renderSidebar("/dashboard");
    await flushEffects();

    // Collapse sidebar first
    const collapseButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label") === "Toggle sidebar expand",
    );
    await act(async () => {
      collapseButton?.click();
    });
    await flushEffects();

    const aside = container.querySelector<HTMLElement>("#ff-sidebar");
    expect(aside?.className).toContain("is-collapsed");

    // Find the Setup rail link
    const setupRailLink = Array.from(container.querySelectorAll<HTMLButtonElement>(".ff-sidebar-rail-link")).find(
      (button) => button.getAttribute("aria-label")?.startsWith("Setup"),
    );
    expect(setupRailLink).not.toBeNull();

    // Click the rail link — should expand sidebar + open Setup section
    await act(async () => {
      setupRailLink?.click();
    });
    await flushEffects();

    expect(aside?.className).toContain("is-open");
    const setupTrigger = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label") === "Setup section",
    );
    expect(setupTrigger?.getAttribute("aria-expanded")).toBe("true");
  });

  it("X close button collapses sidebar on desktop", async () => {
    await renderSidebar("/dashboard");
    await flushEffects();

    // Sidebar starts expanded
    const aside = container.querySelector<HTMLElement>("#ff-sidebar");
    expect(aside?.className).toContain("is-open");

    // Find the X close button
    const closeButton = container.querySelector<HTMLButtonElement>(".ff-sidebar-close");
    expect(closeButton).not.toBeNull();

    // Click to collapse
    await act(async () => {
      closeButton?.click();
    });
    await flushEffects();

    expect(aside?.className).toContain("is-collapsed");
    expect(window.localStorage.getItem("forgeframe.sidebar.expanded")).toBe("false");
  });
});
