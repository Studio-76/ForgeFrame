// @vitest-environment jsdom

import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Outlet, RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchAdminSessionMock,
  rotateOwnPasswordMock,
} = vi.hoisted(() => ({
  fetchAdminSessionMock: vi.fn(),
  rotateOwnPasswordMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");
  return {
    ...actual,
    fetchAdminSession: fetchAdminSessionMock,
    rotateOwnPassword: rotateOwnPasswordMock,
  };
});

import type { AdminSessionUser } from "../src/api/admin";
import { useAppSession } from "../src/app/session";
import { PasswordRotationPage } from "../src/pages/PasswordRotationPage";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root | null = null;

function createRotationSession(overrides: Partial<AdminSessionUser> = {}): AdminSessionUser {
  return {
    session_id: "sess_rotation",
    user_id: "admin_rotation",
    username: "reset-admin",
    display_name: "Reset Admin",
    role: "admin",
    session_type: "standard",
    read_only: false,
    must_rotate_password: true,
    ...overrides,
  };
}

function SessionBoundary() {
  const [session, setSession] = useState<AdminSessionUser | null>(createRotationSession());

  return (
    <Outlet
      context={{
        session,
        sessionReady: true,
        markPasswordRotationComplete: () => undefined,
        replaceSession: setSession,
      }}
    />
  );
}

function ProvidersProbe() {
  const { session } = useAppSession();
  return (
    <div>
      Providers route unlocked for {session?.display_name}. Rotation required: {String(session?.must_rotate_password)}
    </div>
  );
}

async function renderIntoDom(element: ReactNode) {
  root = createRoot(container);
  await act(async () => {
    root?.render(element);
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
  vi.resetAllMocks();
  container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("password rotation flow", () => {
  it("refreshes the unlocked session and returns to the requested control-plane route", async () => {
    rotateOwnPasswordMock.mockResolvedValue({
      status: "ok",
      user: {
        user_id: "admin_rotation",
        username: "reset-admin",
        display_name: "Reset Admin",
        role: "admin",
        status: "active",
        must_rotate_password: false,
        created_at: "2026-04-21T22:00:00Z",
        updated_at: "2026-04-21T22:00:00Z",
      },
    });
    fetchAdminSessionMock.mockResolvedValue({
      status: "ok",
      user: createRotationSession({ must_rotate_password: false }),
    });

    const router = createMemoryRouter([
      {
        path: "/",
        element: <SessionBoundary />,
        children: [
          { path: "rotate-password", element: <PasswordRotationPage /> },
          { path: "providers", element: <ProvidersProbe /> },
        ],
      },
    ], {
      initialEntries: ["/rotate-password?next=%2Fproviders"],
    });

    await renderIntoDom(<RouterProvider router={router} />);

    const currentPassword = container.querySelector<HTMLInputElement>('input[placeholder="current temporary password"]');
    const newPassword = container.querySelector<HTMLInputElement>('input[placeholder="new password"]');
    const confirmPassword = container.querySelector<HTMLInputElement>('input[placeholder="confirm new password"]');
    const form = container.querySelector("form");

    expect(currentPassword).not.toBeNull();
    expect(newPassword).not.toBeNull();
    expect(confirmPassword).not.toBeNull();
    expect(form).not.toBeNull();

    await act(async () => {
      setInputValue(currentPassword!, "Temp-Operator-456");
      setInputValue(newPassword!, "Final-Operator-789");
      setInputValue(confirmPassword!, "Final-Operator-789");
    });

    await act(async () => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(rotateOwnPasswordMock).toHaveBeenCalledWith({
      current_password: "Temp-Operator-456",
      new_password: "Final-Operator-789",
    });
    expect(fetchAdminSessionMock).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe("/providers");
    expect(container.textContent).toContain("Providers route unlocked for Reset Admin.");
    expect(container.textContent).toContain("Rotation required: false");
  });

  it("still unlocks and returns to the requested route when the best-effort session refresh fails", async () => {
    rotateOwnPasswordMock.mockResolvedValue({
      status: "ok",
      user: {
        user_id: "admin_rotation",
        username: "reset-admin",
        display_name: "Reset Admin",
        role: "admin",
        status: "active",
        must_rotate_password: false,
        created_at: "2026-04-21T22:00:00Z",
        updated_at: "2026-04-21T22:00:00Z",
      },
    });
    fetchAdminSessionMock.mockRejectedValue(new Error("Session refresh failed."));

    const router = createMemoryRouter([
      {
        path: "/",
        element: <SessionBoundary />,
        children: [
          { path: "rotate-password", element: <PasswordRotationPage /> },
          { path: "providers", element: <ProvidersProbe /> },
        ],
      },
    ], {
      initialEntries: ["/rotate-password?next=%2Fproviders"],
    });

    await renderIntoDom(<RouterProvider router={router} />);

    const currentPassword = container.querySelector<HTMLInputElement>('input[placeholder="current temporary password"]');
    const newPassword = container.querySelector<HTMLInputElement>('input[placeholder="new password"]');
    const confirmPassword = container.querySelector<HTMLInputElement>('input[placeholder="confirm new password"]');
    const form = container.querySelector("form");

    expect(currentPassword).not.toBeNull();
    expect(newPassword).not.toBeNull();
    expect(confirmPassword).not.toBeNull();
    expect(form).not.toBeNull();

    await act(async () => {
      setInputValue(currentPassword!, "Temp-Operator-456");
      setInputValue(newPassword!, "Final-Operator-789");
      setInputValue(confirmPassword!, "Final-Operator-789");
    });

    await act(async () => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(rotateOwnPasswordMock).toHaveBeenCalledWith({
      current_password: "Temp-Operator-456",
      new_password: "Final-Operator-789",
    });
    expect(fetchAdminSessionMock).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe("/providers");
    expect(container.textContent).toContain("Providers route unlocked for Reset Admin.");
    expect(container.textContent).toContain("Rotation required: false");
    expect(container.textContent).not.toContain("Password rotation could not be completed.");
  });
});
