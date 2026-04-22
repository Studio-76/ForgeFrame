import type { ElevatedAccessRequestType } from "../../api/admin";

export type ElevatedAccessRequestDraft = {
  request_type: ElevatedAccessRequestType;
  approval_reference: string;
  justification: string;
  notification_targets: string;
  duration_minutes: string;
  target_user_id: string;
};

export function createEmptyElevatedAccessRequestDraft(
  overrides: Partial<ElevatedAccessRequestDraft> = {},
): ElevatedAccessRequestDraft {
  return {
    request_type: "break_glass",
    approval_reference: "",
    justification: "",
    notification_targets: "",
    duration_minutes: "15",
    target_user_id: "",
    ...overrides,
  };
}

function normalizeNotificationTargets(rawTargets: string): string[] {
  return rawTargets
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildCommonPayload(draft: ElevatedAccessRequestDraft, maxDurationMinutes: number) {
  const approvalReference = draft.approval_reference.trim();
  if (approvalReference.length < 3) {
    throw new Error("Approval reference must be at least 3 characters.");
  }

  const justification = draft.justification.trim();
  if (justification.length < 8) {
    throw new Error("Justification must be at least 8 characters.");
  }

  const notificationTargets = normalizeNotificationTargets(draft.notification_targets);
  if (notificationTargets.length === 0) {
    throw new Error("At least one notification target is required.");
  }

  const durationMinutes = Number(draft.duration_minutes);
  if (!Number.isFinite(durationMinutes) || !Number.isInteger(durationMinutes) || durationMinutes < 1) {
    throw new Error("Duration must be a whole number of minutes.");
  }
  if (durationMinutes > maxDurationMinutes) {
    throw new Error(`Duration exceeds policy maximum of ${maxDurationMinutes} minutes.`);
  }

  return {
    approval_reference: approvalReference,
    justification,
    notification_targets: notificationTargets,
    duration_minutes: durationMinutes,
  };
}

export function buildBreakGlassRequestPayload(
  draft: ElevatedAccessRequestDraft,
  maxDurationMinutes: number,
) {
  return buildCommonPayload(draft, maxDurationMinutes);
}

export function buildImpersonationRequestPayload(
  draft: ElevatedAccessRequestDraft,
  maxDurationMinutes: number,
) {
  const targetUserId = draft.target_user_id.trim();
  if (!targetUserId) {
    throw new Error("Select a target user for impersonation.");
  }

  return {
    ...buildCommonPayload(draft, maxDurationMinutes),
    target_user_id: targetUserId,
  };
}
