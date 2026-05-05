import type { HarnessSecretPosture, SecuritySecretPosture } from "../../api/domain";
import type {
  AdminUserEditDraft,
  AdminUserScopeDraft,
  RotationDraft,
  RotationTargetOption,
} from "./sections";

/**
 * Create an empty admin user edit draft with default values.
 * @returns Empty edit draft with operator role and active status.
 */
export function buildEmptyUserEditDraft(): AdminUserEditDraft {
  return {
    display_name: "",
    role: "operator",
    status: "active",
  };
}

/**
 * Create an empty secret rotation draft with defaults.
 * @returns Empty rotation draft targeting a provider.
 */
export function buildEmptyRotationDraft(): RotationDraft {
  return {
    target_type: "provider",
    target_id: "",
    kind: "",
    reference: "",
    notes: "",
  };
}

/**
 * Create an empty admin user scope draft with defaults.
 * @returns Empty scope draft with operator role and active status.
 */
export function buildEmptyScopeDraft(): AdminUserScopeDraft {
  return {
    instance_id: "",
    role: "operator",
    status: "active",
  };
}

/**
 * Build the list of rotation target options from secret and harness posture.
 * @param secretPosture - Provider secret posture items.
 * @param harnessProfiles - Harness secret posture items.
 * @returns Sorted rotation target options.
 */
export function buildRotationTargetOptions(
  secretPosture: SecuritySecretPosture[],
  harnessProfiles: HarnessSecretPosture[],
): RotationTargetOption[] {
  const providerTargets = secretPosture
    .filter((item) => item.provider !== "generic_harness")
    .map((item) => ({
      target_type: "provider" as const,
      target_id: item.provider,
      label: `Provider · ${item.provider}`,
      recommended_kind: item.rotation_support,
    }));
  const harnessTargets = harnessProfiles.map((item) => ({
    target_type: "harness_profile" as const,
    target_id: item.provider_key,
    label: `Harness · ${item.label}`,
    recommended_kind: "harness_profile_rotation",
  }));
  return [...providerTargets, ...harnessTargets];
}

/**
 * Look up the recommended rotation kind for a given target.
 * @param targets - Available rotation target options.
 * @param targetType - Target type (provider or harness_profile).
 * @param targetId - Target identifier.
 * @returns Recommended rotation kind or null.
 */
export function rotationKindForTarget(
  targets: RotationTargetOption[],
  targetType: RotationDraft["target_type"],
  targetId: string,
): string | null {
  const selected = targets.find((item) => item.target_type === targetType && item.target_id === targetId);
  return selected?.recommended_kind ?? null;
}
