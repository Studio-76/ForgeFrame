/**
 * Dashboard page.
 *
 * Renders the unified setup flow. The /dashboard route is preserved
 * but now delegates to the SetupPage component which merges password
 * rotation, bootstrap onboarding, and operational status into a single
 * guided experience.
 */
export { SetupPage as DashboardPage } from "../features/setup/SetupPage";
