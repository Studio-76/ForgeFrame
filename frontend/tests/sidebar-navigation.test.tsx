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

async function renderSidebar(path: string, session: AdminSessionUser = adminSession) {
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[path]}>
        <SidebarProvider>
          <MobileSidebarToggleHarness />
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
  it("starts collapsed on desktop and expands a section on demand", async () => {
    await renderSidebar("/dashboard");
    await flushEffects();

    const aside = container.querySelector<HTMLElement>("#ff-sidebar");
    const setupTrigger = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label") === "Open Setup section",
    );
    const setupLinks = container.querySelector<HTMLElement>("#ff-sidebar-section-setup");

    expect(aside?.className).toContain("is-collapsed");
    expect(setupTrigger?.getAttribute("aria-expanded")).toBe("false");
    expect(setupLinks?.hidden).toBe(true);

    await act(async () => {
      setupTrigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(aside?.className).toContain("is-collapsed");
    expect(setupTrigger?.getAttribute("aria-expanded")).toBe("false");
    expect(window.localStorage.getItem("forgeframe.sidebar.expanded")).toBe("false");
    expect(window.localStorage.getItem("forgeframe.sidebar.sections")).toContain("\"setup\":true");
    expect(setupLinks?.hidden).toBe(true);
  });

  it("keeps the active section open even when persisted section state says closed", async () => {
    window.localStorage.setItem("forgeframe.sidebar.expanded", "true");
    window.localStorage.setItem("forgeframe.sidebar.sections", JSON.stringify({ runtime: false }));

    await renderSidebar("/usage");
    await flushEffects();

    const runtimeTrigger = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label") === "Runtime section",
    );
    const currentLink = container.querySelector<HTMLAnchorElement>('a[aria-current="page"]');

    expect(runtimeTrigger?.getAttribute("aria-expanded")).toBe("true");
    expect(currentLink?.getAttribute("href")).toBe("/usage");
    expect(currentLink?.textContent).toContain("Usage");
  });

  it("keeps a permission-limited current route visible inside its open group while the desktop shell stays collapsed", async () => {
    await renderSidebar("/approvals", viewerSession);
    await flushEffects();

    const aside = container.querySelector<HTMLElement>("#ff-sidebar");
    const governanceTrigger = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label") === "Open Governance section",
    );
    const governanceLinks = container.querySelector<HTMLElement>("#ff-sidebar-section-governance");
    const currentDisabledLink = Array.from(container.querySelectorAll<HTMLElement>('[role="link"][aria-disabled="true"]')).find(
      (element) => element.textContent?.includes("Approvals"),
    );

    expect(aside?.className).toContain("is-collapsed");
    expect(governanceTrigger?.getAttribute("aria-expanded")).toBe("false");
    expect(governanceLinks?.hidden).toBe(true);
    expect(currentDisabledLink?.closest<HTMLElement>("#ff-sidebar-section-governance")?.hidden).toBe(true);

    act(() => {
      root?.unmount();
    });
    root = null;

    window.localStorage.setItem("forgeframe.sidebar.expanded", "true");
    await renderSidebar("/approvals", viewerSession);
    await flushEffects();

    const openGovernanceTrigger = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.getAttribute("aria-label") === "Governance section",
    );
    const openGovernanceLinks = container.querySelector<HTMLElement>("#ff-sidebar-section-governance");
    const visibleDisabledLink = Array.from(container.querySelectorAll<HTMLElement>('[role="link"][aria-disabled="true"]')).find(
      (element) => element.textContent?.includes("Approvals"),
    );

    expect(openGovernanceTrigger?.getAttribute("aria-expanded")).toBe("true");
    expect(openGovernanceLinks?.hidden).toBe(false);
    expect(visibleDisabledLink).not.toBeNull();
    expect(visibleDisabledLink?.className).toContain("is-current");
    expect(visibleDisabledLink?.textContent).toContain("Operator or admin");
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
});
