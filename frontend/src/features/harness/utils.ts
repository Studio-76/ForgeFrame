/**
 * Utility functions for the ForgeFrame Harness feature module.
 *
 * Contains derived-state helpers that compute harness status summaries,
 * group runs, and format harness-specific values.
 */
import type { ProvidersPageData } from "../providers/providersShared";
import {
  asRecord,
  formatTimestamp,
  joinList,
  toStringValue,
} from "../providers/providersShared";
import type { HarnessStatusSummary } from "./types";

/**
 * Derive the overall harness status: readiness tone, next step, and
 * primary issue from the current data snapshot.
 */
export function deriveHarnessStatus(
  data: ProvidersPageData,
): HarnessStatusSummary {
  const activeProfiles = data.profiles.filter((p) => p.enabled);
  const attentionProfiles = data.profiles.filter((p) => p.needs_attention);
  const lastRun = data.runs[0] ?? null;

  if (data.profiles.length === 0) {
    return {
      statusTone: "neutral",
      statusLabel: "Not configured",
      nextStep: "Select a provider preset or template to create your first harness profile.",
      nextStepTone: "neutral",
      activeProfile: null,
      activeProfileKey: null,
      lastVerify: "never",
      primaryIssue: null,
    };
  }

  if (attentionProfiles.length > 0) {
    const first = attentionProfiles[0];
    return {
      statusTone: "warning",
      statusLabel: `${attentionProfiles.length} profile${attentionProfiles.length > 1 ? "s" : ""} need attention`,
      nextStep: `Review ${first?.label ?? "the first attention profile"} and resolve issues.`,
      nextStepTone: "warning",
      activeProfile: activeProfiles[0]?.label ?? null,
      activeProfileKey: activeProfiles[0]?.provider_key ?? null,
      lastVerify: lastRun?.status ?? "unknown",
      primaryIssue: first?.last_error ?? "Profile requires attention",
    };
  }

  if (activeProfiles.length === 0) {
    return {
      statusTone: "neutral",
      statusLabel: "No active profile",
      nextStep: "Activate a configured profile to enable harness operations.",
      nextStepTone: "neutral",
      activeProfile: null,
      activeProfileKey: null,
      lastVerify: lastRun?.status ?? "never",
      primaryIssue: null,
    };
  }

  return {
    statusTone: "success",
    statusLabel: `${activeProfiles.length} active profile${activeProfiles.length > 1 ? "s" : ""}`,
    nextStep: lastRun
      ? "Run verification to confirm this profile can serve the selected model."
      : "Run a verification to confirm harness configuration.",
    nextStepTone: "success",
    activeProfile: activeProfiles[0]?.label ?? null,
    activeProfileKey: activeProfiles[0]?.provider_key ?? null,
    lastVerify: lastRun?.status ?? "never",
    primaryIssue: null,
  };
}

/**
 * Group runs by mode type for scannable grouping in run history.
 */
export function groupRunsByMode(
  runs: ProvidersPageData["runs"],
): Record<string, ProvidersPageData["runs"]> {
  const groups: Record<string, ProvidersPageData["runs"]> = {};
  for (const run of runs) {
    const key = run.mode || "unknown";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(run);
  }
  return groups;
}

/**
 * Format a harness run mode for display.
 */
export function formatHarnessMode(mode: string | null | undefined): string {
  if (!mode) {
    return "unknown";
  }
  return mode.replaceAll("_", " ");
}

/**
 * Format harness scope label.
 */
export function formatHarnessScope(profile: { instance_id?: string | null }): string {
  return profile.instance_id?.trim() ? profile.instance_id : "global";
}

/**
 * Get the latest run for a specific harness profile.
 */
export function latestRunForProfile(
  profileKey: string,
  runs: ProvidersPageData["runs"],
  runOps: ProvidersPageData["runOps"],
): ProvidersPageData["runs"][number] | null {
  const directMatch = runs.find((run) => run.provider_key === profileKey);
  if (directMatch) {
    return directMatch;
  }
  const runMap = asRecord(runOps.last_runs_by_provider);
  return (asRecord(runMap?.[profileKey]) as ProvidersPageData["runs"][number]) ?? null;
}

export {
  asRecord,
  formatTimestamp,
  joinList,
  toStringValue,
};
