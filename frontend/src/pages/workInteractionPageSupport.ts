import type { AdminSessionUser } from "../api/domain/auth";
import { roleAllows, sessionHasAnyInstancePermission } from "../app/adminAccess";

export type LoadState = "idle" | "loading" | "success" | "error";

export function parseJsonObject(rawValue: string, fieldLabel: string): Record<string, unknown> {
  const normalized = rawValue.trim();
  if (!normalized) {
    return {};
  }
  const parsed = JSON.parse(normalized) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

export function normalizeOptional(value: string): string | null {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function parseInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Return the latest (most recent) timestamp from a list of nullable
 * timestamp strings. Non-empty strings are sorted lexicographically
 * (valid for ISO-8601), and the last element is returned.
 *
 * @param values - List of nullable timestamp strings.
 * @returns The latest timestamp, or null if none are valid.
 */
export function latestTimestamp(values: Array<string | null | undefined>): string | null {
  const normalized = values
    .filter((value): value is string => Boolean(value && value.trim()))
    .sort();
  return normalized.at(-1) ?? null;
}

export function getWorkInteractionAccess(session: AdminSessionUser | null, sessionReady: boolean) {
  const canRead = sessionReady && (
    sessionHasAnyInstancePermission(session, "execution.read")
    || sessionHasAnyInstancePermission(session, "approvals.read")
  );
  const canMutate = sessionReady && session?.read_only !== true && roleAllows(session?.role, "admin");
  return { canRead, canMutate };
}
