import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";

import { App } from "./app/App";
import { loginRouteLoader, protectedRouteLoader } from "./app/authRouting";
import { PublicShell } from "./app/PublicShell";
import "./theme/index.css";
import { ThemeProvider } from "./theme/ThemeProvider";
import { AccountsPage } from "./pages/AccountsPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ModelsPage } from "./pages/ModelsPage";
import { OAuthTargetsPage } from "./pages/OAuthTargetsPage";
import { PasswordRotationPage } from "./pages/PasswordRotationPage";
import { ProviderTargetsPage } from "./pages/ProviderTargetsPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { RoutingPage } from "./pages/RoutingPage";
import { SettingsPage } from "./pages/SettingsPage";

const OnboardingPage = lazy(async () => import("./pages/OnboardingPage").then((module) => ({ default: module.OnboardingPage })));
const HarnessPage = lazy(async () => import("./pages/HarnessPage").then((module) => ({ default: module.HarnessPage })));
const IngressTlsPage = lazy(async () => import("./pages/IngressTlsPage").then((module) => ({ default: module.IngressTlsPage })));
const PluginsPage = lazy(async () => import("./pages/PluginsPage").then((module) => ({ default: module.PluginsPage })));
const ApprovalsPage = lazy(async () => import("./pages/ApprovalsPage").then((module) => ({ default: module.ApprovalsPage })));
const DispatchPage = lazy(async () => import("./pages/DispatchPage").then((module) => ({ default: module.DispatchPage })));
const ExecutionPage = lazy(async () => import("./pages/ExecutionPage").then((module) => ({ default: module.ExecutionPage })));
const InstancesPage = lazy(async () => import("./pages/InstancesPage").then((module) => ({ default: module.InstancesPage })));
const ConversationsPage = lazy(async () => import("./pages/ConversationsPage").then((module) => ({ default: module.ConversationsPage })));
const InboxPage = lazy(async () => import("./pages/InboxPage").then((module) => ({ default: module.InboxPage })));
const TasksPage = lazy(async () => import("./pages/TasksPage").then((module) => ({ default: module.TasksPage })));
const RemindersPage = lazy(async () => import("./pages/RemindersPage").then((module) => ({ default: module.RemindersPage })));
const AutomationsPage = lazy(async () => import("./pages/AutomationsPage").then((module) => ({ default: module.AutomationsPage })));
const NotificationsPage = lazy(async () => import("./pages/NotificationsPage").then((module) => ({ default: module.NotificationsPage })));
const ChannelsPage = lazy(async () => import("./pages/ChannelsPage").then((module) => ({ default: module.ChannelsPage })));
const ContactsPage = lazy(async () => import("./pages/ContactsPage").then((module) => ({ default: module.ContactsPage })));
const KnowledgeSourcesPage = lazy(async () => import("./pages/KnowledgeSourcesPage").then((module) => ({ default: module.KnowledgeSourcesPage })));
const MemoryPage = lazy(async () => import("./pages/MemoryPage").then((module) => ({ default: module.MemoryPage })));
const AssistantProfilesPage = lazy(async () => import("./pages/AssistantProfilesPage").then((module) => ({ default: module.AssistantProfilesPage })));
const QueuesPage = lazy(async () => import("./pages/QueuesPage").then((module) => ({ default: module.QueuesPage })));
const ReleaseValidationPage = lazy(async () => import("./pages/ReleaseValidationPage").then((module) => ({ default: module.ReleaseValidationPage })));
const WorkspacesPage = lazy(async () => import("./pages/WorkspacesPage").then((module) => ({ default: module.WorkspacesPage })));
const ArtifactsPage = lazy(async () => import("./pages/ArtifactsPage").then((module) => ({ default: module.ArtifactsPage })));
const SecurityPage = lazy(async () => import("./pages/SecurityPage").then((module) => ({ default: module.SecurityPage })));
const HealthPage = lazy(async () => import("./pages/HealthPage").then((module) => ({ default: module.HealthPage })));
const UsagePage = lazy(async () => import("./pages/UsagePage").then((module) => ({ default: module.UsagePage })));
const CostsPage = lazy(async () => import("./pages/CostsPage").then((module) => ({ default: module.CostsPage })));
const ErrorsPage = lazy(async () => import("./pages/ErrorsPage").then((module) => ({ default: module.ErrorsPage })));
const LogsPage = lazy(async () => import("./pages/LogsPage").then((module) => ({ default: module.LogsPage })));

function RouteModuleFallback() {
  return (
    <section className="fg-page">
      <article className="fg-card">
        <h2>Loading Control Plane Module</h2>
        <p className="fg-muted">ForgeFrame is loading the selected operator surface instead of shipping every heavy page in the initial bundle.</p>
      </article>
    </section>
  );
}

function lazyRoute(element: React.ReactNode) {
  return <Suspense fallback={<RouteModuleFallback />}>{element}</Suspense>;
}

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
      { path: "onboarding", element: lazyRoute(<OnboardingPage />) },
      { path: "instances", element: lazyRoute(<InstancesPage />) },
      { path: "harness", element: lazyRoute(<HarnessPage />) },
      { path: "providers", element: <ProvidersPage /> },
      { path: "oauth-targets", element: <OAuthTargetsPage /> },
      { path: "models", element: <ModelsPage /> },
      { path: "provider-targets", element: <ProviderTargetsPage /> },
      { path: "routing", element: <RoutingPage /> },
      { path: "plugins", element: lazyRoute(<PluginsPage />) },
      { path: "ingress-tls", element: lazyRoute(<IngressTlsPage />) },
      { path: "release-validation", element: lazyRoute(<ReleaseValidationPage />) },
      { path: "accounts", element: <AccountsPage /> },
      { path: "api-keys", element: <ApiKeysPage /> },
      { path: "approvals", element: lazyRoute(<ApprovalsPage />) },
      { path: "execution", element: lazyRoute(<ExecutionPage />) },
      { path: "queues", element: lazyRoute(<QueuesPage />) },
      { path: "dispatch", element: lazyRoute(<DispatchPage />) },
      { path: "conversations", element: lazyRoute(<ConversationsPage />) },
      { path: "inbox", element: lazyRoute(<InboxPage />) },
      { path: "tasks", element: lazyRoute(<TasksPage />) },
      { path: "reminders", element: lazyRoute(<RemindersPage />) },
      { path: "automations", element: lazyRoute(<AutomationsPage />) },
      { path: "notifications", element: lazyRoute(<NotificationsPage />) },
      { path: "channels", element: lazyRoute(<ChannelsPage />) },
      { path: "contacts", element: lazyRoute(<ContactsPage />) },
      { path: "knowledge-sources", element: lazyRoute(<KnowledgeSourcesPage />) },
      { path: "memory", element: lazyRoute(<MemoryPage />) },
      { path: "assistant-profiles", element: lazyRoute(<AssistantProfilesPage />) },
      { path: "workspaces", element: lazyRoute(<WorkspacesPage />) },
      { path: "artifacts", element: lazyRoute(<ArtifactsPage />) },
      { path: "security", element: lazyRoute(<SecurityPage />) },
      { path: "health-status", element: lazyRoute(<HealthPage />) },
      { path: "usage", element: lazyRoute(<UsagePage />) },
      { path: "costs", element: lazyRoute(<CostsPage />) },
      { path: "errors", element: lazyRoute(<ErrorsPage />) },
      { path: "logs", element: lazyRoute(<LogsPage />) },
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
