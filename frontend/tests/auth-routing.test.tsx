import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, type Router, RouterProvider } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/app/App";
import { loginRouteLoader, protectedRouteLoader } from "../src/app/authRouting";
import { PublicShell } from "../src/app/PublicShell";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { DashboardPage } from "../src/pages/DashboardPage";
import { LoginPage } from "../src/pages/LoginPage";
import { PasswordRotationPage } from "../src/pages/PasswordRotationPage";
import { ProvidersPage } from "../src/pages/ProvidersPage";

type TestGlobal = typeof globalThis & {
  window?: Window & typeof globalThis;
  fetch?: typeof fetch;
};

const testGlobal = globalThis as TestGlobal;
const originalWindow = testGlobal.window;
const originalFetch = testGlobal.fetch;

const routes = [
  {
    path: "/login",
    loader: loginRouteLoader,
    element: <PublicShell />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: "/",
    loader: protectedRouteLoader,
    element: <App />,
    children: [
      { path: "dashboard", element: <DashboardPage /> },
      { path: "providers", element: <ProvidersPage /> },
      { path: "rotate-password", element: <PasswordRotationPage /> },
    ],
  },
];

function createStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    get length() {
      return values.size;
    },
  };
}

function installWindow(seed: Record<string, string> = {}) {
  testGlobal.window = {
    localStorage: createStorage(seed),
  } as Window & typeof globalThis;
}

async function waitForRouter(router: Router) {
  if (router.state.initialized && router.state.navigation.state === "idle") {
    return;
  }

  await new Promise<void>((resolve) => {
    const unsubscribe = router.subscribe((state) => {
      if (state.initialized && state.navigation.state === "idle") {
        unsubscribe();
        resolve();
      }
    });
  });
}

async function renderRoute(initialEntries: string[]) {
  const router = createMemoryRouter(routes, { initialEntries });
  await waitForRouter(router);
  const markup = renderToStaticMarkup(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );

  return { router, markup };
}

afterEach(() => {
  vi.restoreAllMocks();

  if (originalWindow === undefined) {
    delete testGlobal.window;
  } else {
    testGlobal.window = originalWindow;
  }

  if (originalFetch === undefined) {
    delete testGlobal.fetch;
  } else {
    testGlobal.fetch = originalFetch;
  }
});

describe("control-plane auth routing", () => {
  it("keeps the signed-out login shell free of protected navigation links", async () => {
    const { markup } = await renderRoute(["/login"]);

    expect(markup).toContain("Sign-In Boundary");
    expect(markup).toContain(">Login<");
    expect(markup).not.toContain("Command Center");
    expect(markup).not.toContain("Providers &amp; Harness");
  });

  it("redirects signed-out protected routes to login and preserves the next path", async () => {
    const { router, markup } = await renderRoute(["/providers"]);

    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe("?next=%2Fproviders");
    expect(markup).toContain("Continue After Sign-In");
    expect(markup).toContain("/providers");
  });

  it("redirects authenticated login attempts back into the protected shell", async () => {
    installWindow({ forgegate_admin_token: "fgas_test_token" });
    testGlobal.fetch = vi.fn(async () => new Response(
      JSON.stringify({
        status: "ok",
        user: {
          session_id: "sess_1",
          user_id: "user_1",
          username: "operator",
          display_name: "Ops Lead",
          role: "operator",
          session_type: "standard",
          read_only: false,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )) as typeof fetch;

    const { router, markup } = await renderRoute(["/login"]);

    expect(router.state.location.pathname).toBe("/dashboard");
    expect(markup).not.toContain("Sign-In Boundary");
  });
});
