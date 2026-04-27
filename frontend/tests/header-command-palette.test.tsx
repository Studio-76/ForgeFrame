// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminSessionUser } from "../src/api/admin";
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

async function renderHeader(path: string, session: AdminSessionUser = viewerSession) {
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider>
          <SidebarProvider>
            <AppHeader
              navigationSections={getControlPlaneNavigation(session)}
              instanceId={null}
              session={session}
              sessionError=""
              onLogout={vi.fn()}
            />
          </SidebarProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );
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
});
