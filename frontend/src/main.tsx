import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";

import { App } from "./app/App";
import { loginRouteLoader, protectedRouteLoader } from "./app/authRouting";
import { PublicShell } from "./app/PublicShell";
import { QueryProvider } from "./app/QueryProvider";
import { RouteErrorBoundaryView } from "./app/RouteErrorBoundary";
import "./theme/index.css";
import { ThemeProvider } from "./theme/ThemeProvider";
import { LoginPage } from "./pages/LoginPage";

const PasswordRotationPage = lazy(async () => import("./pages/PasswordRotationPage").then((module) => ({ default: module.PasswordRotationPage })));
const DashboardPage = lazy(async () => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ProvidersPage = lazy(async () => import("./pages/ProvidersPage").then((module) => ({ default: module.ProvidersPage })));
const OAuthTargetsPage = lazy(async () => import("./pages/OAuthTargetsPage").then((module) => ({ default: module.OAuthTargetsPage })));
const ModelsPage = lazy(async () => import("./pages/ModelsPage").then((module) => ({ default: module.ModelsPage })));
const ProviderTargetsPage = lazy(async () => import("./pages/ProviderTargetsPage").then((module) => ({ default: module.ProviderTargetsPage })));
const RoutingPage = lazy(async () => import("./pages/RoutingPage").then((module) => ({ default: module.RoutingPage })));
const AccountsPage = lazy(async () => import("./pages/AccountsPage").then((module) => ({ default: module.AccountsPage })));
const ApiKeysPage = lazy(async () => import("./pages/ApiKeysPage").then((module) => ({ default: module.ApiKeysPage })));
const SettingsPage = lazy(async () => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const HarnessPage = lazy(async () => import("./pages/HarnessPage").then((module) => ({ default: module.HarnessPage })));
const IngressTlsPage = lazy(async () => import("./pages/IngressTlsPage").then((module) => ({ default: module.IngressTlsPage })));
const PluginsPage = lazy(async () => import("./pages/PluginsPage").then((module) => ({ default: module.PluginsPage })));
const RecoveryPage = lazy(async () => import("./pages/RecoveryPage").then((module) => ({ default: module.RecoveryPage })));
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
const AgentsPage = lazy(async () => import("./pages/AgentsPage").then((module) => ({ default: module.AgentsPage })));
const ChannelsPage = lazy(async () => import("./pages/ChannelsPage").then((module) => ({ default: module.ChannelsPage })));
const ContactsPage = lazy(async () => import("./pages/ContactsPage").then((module) => ({ default: module.ContactsPage })));
const KnowledgeSourcesPage = lazy(async () => import("./pages/KnowledgeSourcesPage").then((module) => ({ default: module.KnowledgeSourcesPage })));
const MemoryPage = lazy(async () => import("./pages/MemoryPage").then((module) => ({ default: module.MemoryPage })));
const LearningPage = lazy(async () => import("./pages/LearningPage").then((module) => ({ default: module.LearningPage })));
const SkillsPage = lazy(async () => import("./pages/SkillsPage").then((module) => ({ default: module.SkillsPage })));
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

/**
 * HydrateFallback for data-router hydration (client-only SPA, never rendered).
 * React Router v7 warns without this for data-router route groups.
 * @returns Null — hydration completes synchronously for client-only routes.
 */
function HydrateFallback() {
  return null;
}

/**
 * Suspense fallback while route modules are loading.
 * @returns Loading shell for lazy route chunks.
 */
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

/**
 * Wrap route content with lazy loading and runtime recovery boundaries.
 * @param element - Route element to render.
 * @returns Route shell with suspense and error containment.
 */
function lazyRoute(element: React.ReactNode) {
  return (
    <RouteErrorBoundaryView>
      <Suspense fallback={<RouteModuleFallback />}>{element}</Suspense>
    </RouteErrorBoundaryView>
  );
}

const router = createBrowserRouter([
  {
    path: "/login",
    HydrateFallback: HydrateFallback,
    loader: loginRouteLoader,
    element: <PublicShell />,
    children: [{ index: true, element: lazyRoute(<LoginPage />) }],
  },
  {
    path: "/",
    HydrateFallback: HydrateFallback,
    loader: protectedRouteLoader,
    element: <App />,
    children: [
      { index: true, element: <Navigate replace to="/dashboard" /> },
      { path: "rotate-password", element: lazyRoute(<PasswordRotationPage />) },
      { path: "dashboard", element: lazyRoute(<DashboardPage />) },
      { path: "onboarding", element: <Navigate replace to="/dashboard" /> },
      { path: "instances", element: lazyRoute(<InstancesPage />) },
      { path: "harness", element: lazyRoute(<HarnessPage />) },
      { path: "providers", element: lazyRoute(<ProvidersPage />) },
      { path: "oauth-targets", element: lazyRoute(<OAuthTargetsPage />) },
      { path: "models", element: lazyRoute(<ModelsPage />) },
      { path: "provider-targets", element: lazyRoute(<ProviderTargetsPage />) },
      { path: "routing", element: lazyRoute(<RoutingPage />) },
      { path: "plugins", element: lazyRoute(<PluginsPage />) },
      { path: "ingress-tls", element: lazyRoute(<IngressTlsPage />) },
      { path: "release-validation", element: lazyRoute(<ReleaseValidationPage />) },
      { path: "recovery", element: lazyRoute(<RecoveryPage />) },
      { path: "accounts", element: lazyRoute(<AccountsPage />) },
      { path: "api-keys", element: lazyRoute(<ApiKeysPage />) },
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
      { path: "agents", element: lazyRoute(<AgentsPage />) },
      { path: "channels", element: lazyRoute(<ChannelsPage />) },
      { path: "contacts", element: lazyRoute(<ContactsPage />) },
      { path: "knowledge-sources", element: lazyRoute(<KnowledgeSourcesPage />) },
      { path: "memory", element: lazyRoute(<MemoryPage />) },
      { path: "learning", element: lazyRoute(<LearningPage />) },
      { path: "skills", element: lazyRoute(<SkillsPage />) },
      { path: "assistant-profiles", element: lazyRoute(<AssistantProfilesPage />) },
      { path: "workspaces", element: lazyRoute(<WorkspacesPage />) },
      { path: "artifacts", element: lazyRoute(<ArtifactsPage />) },
      { path: "security", element: lazyRoute(<SecurityPage />) },
      { path: "health-status", element: lazyRoute(<HealthPage />) },
      { path: "usage", element: lazyRoute(<UsagePage />) },
      { path: "costs", element: lazyRoute(<CostsPage />) },
      { path: "errors", element: lazyRoute(<ErrorsPage />) },
      { path: "logs", element: lazyRoute(<LogsPage />) },
      { path: "settings", element: lazyRoute(<SettingsPage />) },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryProvider>
        <RouterProvider router={router} />
      </QueryProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
