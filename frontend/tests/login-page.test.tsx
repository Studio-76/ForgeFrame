// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  loginAdminMock,
  setAdminTokenMock,
  getAdminTokenMock,
  fetchAdminSessionMock,
  logoutAdminMock,
  clearAdminTokenMock,
} = vi.hoisted(() => ({
  loginAdminMock: vi.fn(),
  setAdminTokenMock: vi.fn(),
  getAdminTokenMock: vi.fn(),
  fetchAdminSessionMock: vi.fn(),
  logoutAdminMock: vi.fn(),
  clearAdminTokenMock: vi.fn(),
}));

vi.mock("../src/api/admin", () => ({
  clearAdminToken: clearAdminTokenMock,
  fetchAdminSession: fetchAdminSessionMock,
  getAdminToken: getAdminTokenMock,
  loginAdmin: loginAdminMock,
  logoutAdmin: logoutAdminMock,
  setAdminToken: setAdminTokenMock,
}));

import { loginRouteLoader } from "../src/app/authRouting";
import { PublicShell } from "../src/app/PublicShell";
import { LoginPage } from "../src/pages/LoginPage";
import { ThemeProvider } from "../src/theme/ThemeProvider";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root | null = null;

function createSessionUser() {
  return {
    session_id: "session-1",
    user_id: "admin-1",
    username: "ops-admin",
    display_name: "Ops Admin",
    role: "admin" as const,
  };
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

async function fillLoginForm(username: string, password: string) {
  const usernameInput = container.querySelector<HTMLInputElement>('input[name="username"]');
  const passwordInput = container.querySelector<HTMLInputElement>('input[name="password"]');

  expect(usernameInput).not.toBeNull();
  expect(passwordInput).not.toBeNull();

  await act(async () => {
    setInputValue(usernameInput!, username);
    setInputValue(passwordInput!, password);
  });
}

async function submitLoginForm() {
  const form = container.querySelector("form");

  expect(form).not.toBeNull();

  await act(async () => {
    form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await flushEffects();
}

beforeEach(() => {
  vi.resetAllMocks();
  getAdminTokenMock.mockReturnValue("");
  fetchAdminSessionMock.mockResolvedValue({
    status: "ok",
    user: createSessionUser(),
  });
  logoutAdminMock.mockResolvedValue({
    status: "ok",
    message: "Admin session revoked.",
  });
  container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
  window.localStorage.clear();
});

describe("Login page", () => {
  it("stays a plain sign-in surface without seeded credentials or bootstrap posture", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const emptyValueMatches = markup.match(/value=""/g) ?? [];

    expect(markup).toContain("Sign in with an administrator account");
    expect(markup).toContain('autoComplete="username"');
    expect(markup).toContain('autoComplete="current-password"');
    expect(markup).toContain(">Sign in</button>");
    expect(emptyValueMatches).toHaveLength(2);
    expect(markup).not.toContain("Bootstrap Status");
    expect(markup).not.toContain("bootstrap_username");
    expect(markup).not.toContain("default_password");
    expect(markup).not.toContain("forgegate-admin");
    expect(markup).not.toContain('value="admin"');
  });

  it("submits credentials, stores the returned token, and routes to /dashboard", async () => {
    loginAdminMock.mockResolvedValue({
      status: "ok",
      access_token: "token-123",
      expires_at: "2026-04-21T22:00:00Z",
      user: createSessionUser(),
    });

    const router = createMemoryRouter([
      { path: "/login", element: <LoginPage /> },
      { path: "/dashboard", element: <div>Dashboard route</div> },
    ], {
      initialEntries: ["/login"],
    });

    await renderIntoDom(<RouterProvider router={router} />);
    await fillLoginForm("ops-admin", "Temp-ForgeGate-42");
    await submitLoginForm();

    expect(loginAdminMock).toHaveBeenCalledWith({
      username: "ops-admin",
      password: "Temp-ForgeGate-42",
    });
    expect(setAdminTokenMock).toHaveBeenCalledWith("token-123");
    expect(router.state.location.pathname).toBe("/dashboard");
    expect(container.textContent).toContain("Dashboard route");
  });

  it("keeps the hardened login route on /login and surfaces invalid-credential errors without bootstrap disclosure", async () => {
    loginAdminMock.mockRejectedValue(new Error("Invalid admin credentials."));

    const router = createMemoryRouter([
      { path: "/login", element: <LoginPage /> },
      { path: "/dashboard", element: <div>Dashboard route</div> },
    ], {
      initialEntries: ["/login"],
    });

    await renderIntoDom(<RouterProvider router={router} />);
    await fillLoginForm("ops-admin", "wrong-pass");
    await submitLoginForm();

    expect(loginAdminMock).toHaveBeenCalledWith({
      username: "ops-admin",
      password: "wrong-pass",
    });
    expect(setAdminTokenMock).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/login");
    expect(container.textContent).toContain("Invalid admin credentials.");
    expect(container.textContent).not.toContain("Bootstrap Status");
    expect(container.textContent).not.toContain("bootstrap_username");
    expect(container.textContent).not.toContain("default_password");
    expect(container.textContent).not.toContain("forgegate-admin");
  });

  it("keeps signed-out /login inside the auth-only boundary without control-plane navigation", async () => {
    const router = createMemoryRouter([
      {
        path: "/login",
        loader: loginRouteLoader,
        element: (
          <ThemeProvider>
            <PublicShell />
          </ThemeProvider>
        ),
        children: [{ index: true, element: <LoginPage /> }],
      },
    ], {
      initialEntries: ["/login"],
    });

    await renderIntoDom(<RouterProvider router={router} />);
    await flushEffects();

    expect(fetchAdminSessionMock).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/login");
    expect(container.querySelector('nav[aria-label="Authentication navigation"]')).not.toBeNull();
    expect(container.querySelector('nav[aria-label="Control-plane navigation"]')).toBeNull();
    expect(container.textContent).toContain("Sign-In Boundary");
    expect(container.textContent).toContain("Login");
    expect(container.textContent).not.toContain("Command Center");
    expect(container.textContent).not.toContain("Security & Policies");
    expect(container.textContent).not.toContain("Bootstrap Status");
    expect(container.textContent).not.toContain("default_password");
  });
});
