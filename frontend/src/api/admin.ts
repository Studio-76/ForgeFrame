/**
 * Legacy admin API compat barrel.
 *
 * @deprecated Import directly from `./domain/<module>` instead of `./admin`.
 * This barrel exists only as a temporary compatibility shim for consumers that
 * have not yet migrated to the domain-specific import surface. All new code
 * MUST import from `./domain` or a specific domain barrel (e.g. `./domain/auth`).
 *
 * TODO(#756393a4): Remove this compat barrel once all consumers have been
 * migrated away from `../api/admin` imports. Tracked by Chapter 9.0.
 */

export * from "./domain";
