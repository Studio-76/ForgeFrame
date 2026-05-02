import type { HarnessSecretPosture, SecuritySecretPosture } from "../../api/domain";
import type {
  AdminUserEditDraft,
  AdminUserScopeDraft,
  RotationDraft,
  RotationTargetOption,
} from "./sections";

export function buildEmptyUserEditDraft(): AdminUserEditDraft {
  return {
    display_name: "",
    role: "operator",
    status: "active",
  };
}

export function buildEmptyRotationDraft(): RotationDraft {
  return {
    target_type: "provider",
    target_id: "",
    kind: "",
    reference: "",
    notes: "",
  };
}

export function buildEmptyScopeDraft(): AdminUserScopeDraft {
  return {
    instance_id: "",
    role: "operator",
    status: "active",
  };
}

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

export function rotationKindForTarget(
  targets: RotationTargetOption[],
  targetType: RotationDraft["target_type"],
  targetId: string,
): string | null {
  const selected = targets.find((item) => item.target_type === targetType && item.target_id === targetId);
  return selected?.recommended_kind ?? null;
}
