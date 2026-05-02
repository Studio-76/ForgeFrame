// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminSessionUser } from "../src/api/domain";
import { getControlPlaneNavigation } from "../src/app/navigation";
import { AppHeader } from "../src/components/layout/AppHeader";
import { SidebarProvider } from "../src/components/layout/SidebarContext";
import { ThemeProvider } from "../src/theme/ThemeProvider";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const viewerSession: AdminSessionUser = {
  session_id: "session-viewer",
  user_id: "user-viewer",
  username: "viewer",
  display_name: "Viewer",
  role: "viewer",
};

let container: HTMLDivElement;
let root: Root | null = null;

function HeaderHarness({ session }: { session: AdminSessionUser }) {
  const location = useLocation();

  return (
    <>
      <AppHeader
        navigationSections={getControlPlaneNavigation(session)}
        instanceId={null}
        session={session}
        sessionError=""
        onLogout={vi.fn()}
      />
      <div data-route-probe>{`${location.pathname}${location.search}${location.hash}`}</div>
    </>
  );
}

async function renderHeader(path: string, session: AdminSessionUser = viewerSession) {
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider>
          <SidebarProvider>
            <HeaderHarness session={session} />
          </SidebarProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );
  });
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const prototype = Object.getPrototypeOf(input) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
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

describe("header command palette", () => {
  it("keeps permission-limited grouped routes searchable and honestly marked", async () => {
    await renderHeader("/dashboard");

    const searchInput = container.querySelector<HTMLInputElement>('input[aria-label="Search command surfaces"]');
    expect(searchInput).not.toBeNull();

    await act(async () => {
      searchInput?.focus();
      setInputValue(searchInput!, "approvals");
    });

    const commandMenu = container.querySelector<HTMLElement>("#ff-command-menu");
    const approvalsOption = Array.from(container.querySelectorAll<HTMLButtonElement>('#ff-command-menu button')).find(
      (button) => button.textContent?.includes("Approvals"),
    );

    expect(commandMenu?.textContent).toContain("Governance");
    expect(approvalsOption).not.toBeNull();
    expect(approvalsOption?.getAttribute("aria-disabled")).toBe("true");
    expect(approvalsOption?.textContent).toContain("Operator or admin");
  });

  it("opens enabled command-palette results from the keyboard", async () => {
    await renderHeader("/dashboard");

    const searchInput = container.querySelector<HTMLInputElement>('input[aria-label="Search command surfaces"]');
    expect(searchInput).not.toBeNull();

    await act(async () => {
      searchInput?.focus();
      setInputValue(searchInput!, "settings");
    });

    const settingsOption = Array.from(container.querySelectorAll<HTMLButtonElement>('#ff-command-menu button')).find(
      (button) => button.textContent?.includes("System Settings"),
    );

    expect(settingsOption).not.toBeNull();

    await act(async () => {
      settingsOption?.focus();
      settingsOption?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await flushEffects();

    const routeProbe = container.querySelector<HTMLElement>("[data-route-probe]");
    expect(routeProbe?.textContent).toBe("/settings");
  });

  it("does not activate disabled command-palette results", async () => {
    await renderHeader("/dashboard");

    const searchInput = container.querySelector<HTMLInputElement>('input[aria-label="Search command surfaces"]');
    expect(searchInput).not.toBeNull();

    await act(async () => {
      searchInput?.focus();
      setInputValue(searchInput!, "approvals");
    });

    const approvalsOption = Array.from(container.querySelectorAll<HTMLButtonElement>('#ff-command-menu button')).find(
      (button) => button.textContent?.includes("Approvals"),
    );

    expect(approvalsOption).not.toBeNull();
    expect(approvalsOption?.disabled).toBe(true);

    await act(async () => {
      approvalsOption?.click();
    });
    await flushEffects();

    const routeProbe = container.querySelector<HTMLElement>("[data-route-probe]");
    expect(routeProbe?.textContent).toBe("/dashboard");
  });
});
