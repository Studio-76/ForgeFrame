/**
 * Domain-level admin API module exports.
 *
 * All domain barrels re-export from their respective admin implementation
 * modules under ../admin/, providing a stable canonical import surface.
 */
export * from "./accounts";
export * from "./agents";
export * from "./approvals";
export * from "./artifacts";
export * from "./assistant-profiles";
export * from "./audit";
export * from "./auth";
export * from "./automations";
export * from "./bootstrap";
export * from "./channels";
export * from "./contacts";
export * from "./conversations";
export * from "./dashboard";
export * from "./execution";
export * from "./health";
export * from "./inbox";
export * from "./ingress-tls";
export * from "./instances";
export * from "./knowledge-sources";
export * from "./learning";
export * from "./logs";
export * from "./memory";
export * from "./notifications";
export * from "./plugins";
export * from "./providers";
export * from "./recovery";
export * from "./reminders";
export * from "./routing";
export * from "./runtime-keys";
export * from "./security";
export * from "./settings";
export * from "./skills";
export * from "./tasks";
export * from "./usage";
export * from "./workspaces";
