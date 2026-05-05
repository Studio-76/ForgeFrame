/**
 * Health feature module — decomposed types, helpers, and components
 * for the health & readiness surface.
 *
 * @packageDocumentation
 */

export { HealthGroupCard } from "./components/HealthGroupCard";
export type { HealthGroupCardProps } from "./components/HealthGroupCard";

export type {
  CheckRecord,
  HealthGroup,
  HealthRoute,
  HealthStatus,
  LoadState,
  SignalPathRow,
} from "./types";

export {
  buildGroup,
  dashboardStatusToHealth,
  formatTimestamp,
  isDefined,
  labelForStatus,
  providerNeedsOauthHandoff,
  summarizeBootstrapChecks,
  summarizeChecks,
  summarizeSignals,
  toneForStatus,
} from "./helpers";
