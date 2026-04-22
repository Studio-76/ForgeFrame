import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";

import { App } from "./app/App";
import { loginRouteLoader, protectedRouteLoader } from "./app/authRouting";
import { PublicShell } from "./app/PublicShell";
import "./theme/index.css";
import { ThemeProvider } from "./theme/ThemeProvider";
import { AccountsPage } from "./pages/AccountsPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExecutionPage } from "./pages/ExecutionPage";
import { LoginPage } from "./pages/LoginPage";
import { LogsPage } from "./pages/LogsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { PasswordRotationPage } from "./pages/PasswordRotationPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { SecurityPage } from "./pages/SecurityPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsagePage } from "./pages/UsagePage";

const router = createBrowserRouter([
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
      { index: true, element: <Navigate replace to="/dashboard" /> },
      { path: "rotate-password", element: <PasswordRotationPage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "onboarding", element: <OnboardingPage /> },
      { path: "providers", element: <ProvidersPage /> },
      { path: "accounts", element: <AccountsPage /> },
      { path: "api-keys", element: <ApiKeysPage /> },
      { path: "approvals", element: <ApprovalsPage /> },
      { path: "execution", element: <ExecutionPage /> },
      { path: "security", element: <SecurityPage /> },
      { path: "usage", element: <UsagePage /> },
      { path: "logs", element: <LogsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>,
);
