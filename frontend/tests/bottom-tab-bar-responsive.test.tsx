// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CONTROL_PLANE_ROUTES, getControlPlaneNavigation } from "../src/app/navigation";
import { AppSidebar } from "../src/components/layout/AppSidebar";
import { BottomTabBar } from "../src/components/layout/BottomTabBar";
import { SidebarProvider, useSidebar } from "../src/components/layout/SidebarContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root | null = null;

function MobileLayoutHarness() {
  const { toggleMobileSidebar, isMobileOpen, viewport } = useSidebar();
  const location = useLocation();

  return (
    <>
      <button type="button" onClick={toggleMobileSidebar}>
        Toggle mobile sidebar
      </button>
      <div data-mobile-open={String(isMobileOpen)} data-viewport={viewport} />
      <div data-route-probe>{location.pathname}</div>
      <AppSidebar navigationSections={getControlPlaneNavigation(null)} instanceId={null} />
      <BottomTabBar instanceId={null} />
    </>
  );
}

async function renderHarness(path: string) {
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[path]}>
        <SidebarProvider>
          <MobileLayoutHarness />
        </SidebarProvider>
      </MemoryRouter>,
    );
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

describe("bottom tab bar responsive behavior", () => {
  it("marks tab as active on nested route paths", async () => {
    setViewportWidth(375);
    await renderHarness("/settings/security");
    await flushAnimationFrame();

    const settingsTab = Array.from(container.querySelectorAll<HTMLAnchorElement>(".ff-bottom-tab")).find(
      (tab) => tab.textContent?.includes("Settings"),
    );

    expect(settingsTab?.className).toContain("is-active");
    expect(settingsTab?.getAttribute("aria-current")).toBe("page");
  });

  it("uses root route fallback for dashboard tab", async () => {
    setViewportWidth(375);
    await renderHarness("/");
    await flushAnimationFrame();

    const dashboardTab = Array.from(container.querySelectorAll<HTMLAnchorElement>(".ff-bottom-tab")).find(
      (tab) => tab.textContent?.includes("Dashboard"),
    );

    expect(dashboardTab?.className).toContain("is-active");
    expect(dashboardTab?.getAttribute("href")).toBe(CONTROL_PLANE_ROUTES.dashboard);
  });

  it("closes mobile sidebar when a tab is clicked", async () => {
    setViewportWidth(375);
    await renderHarness("/dashboard");
    await flushAnimationFrame();

    const stateProbe = container.querySelector<HTMLElement>("[data-mobile-open]");
    const toggleButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Toggle mobile sidebar",
    );

    expect(stateProbe?.getAttribute("data-mobile-open")).toBe("false");

    await act(async () => {
      toggleButton?.click();
    });
    expect(stateProbe?.getAttribute("data-mobile-open")).toBe("true");

    const conversationsTab = Array.from(container.querySelectorAll<HTMLAnchorElement>(".ff-bottom-tab")).find(
      (tab) => tab.textContent?.includes("Conversations"),
    );

    await act(async () => {
      conversationsTab?.click();
    });

    expect(stateProbe?.getAttribute("data-mobile-open")).toBe("false");
    const routeProbe = container.querySelector<HTMLElement>("[data-route-probe]");
    expect(routeProbe?.textContent).toBe(CONTROL_PLANE_ROUTES.conversations);
  });

  it("updates viewport tier across mobile/tablet/desktop thresholds", async () => {
    setViewportWidth(639);
    await renderHarness("/dashboard");
    await flushAnimationFrame();

    const stateProbe = container.querySelector<HTMLElement>("[data-viewport]");
    expect(stateProbe?.getAttribute("data-viewport")).toBe("mobile");

    await act(async () => {
      setViewportWidth(640);
      window.dispatchEvent(new Event("resize"));
    });
    await flushAnimationFrame();
    expect(stateProbe?.getAttribute("data-viewport")).toBe("tablet");

    await act(async () => {
      setViewportWidth(1024);
      window.dispatchEvent(new Event("resize"));
    });
    await flushAnimationFrame();
    expect(stateProbe?.getAttribute("data-viewport")).toBe("desktop");
  });
});
