/**
 * API Keys feature — types, form states, and constants.
 *
 * @packageDocumentation
 */

import type {
  RuntimeKey,
  RuntimeKeyRequestPathPolicy,
} from "../../api/domain/runtime-keys";

// ─── Load / drawer state types ────────────────────────────────────────────

/** Standard data-fetching load state. */
export type LoadState = "idle" | "loading" | "success" | "error";

/** Drawer open/closed mode. */
export type DrawerMode = "closed" | "issue";

/** Status filter including "all". */
export type StatusFilter = RuntimeKey["status"] | "all";

// ─── Form types ───────────────────────────────────────────────────────────

/** Request-path policy draft (editable form fields). */
export type RuntimeKeyPolicyDraft = {
  allowed_request_paths: string;
  default_request_path: RuntimeKeyRequestPathPolicy["default_request_path"];
  pinned_target_key: string;
  local_only_policy: RuntimeKeyRequestPathPolicy["local_only_policy"];
  review_required_conditions: string;
};

/** Runtime key issue form state. */
export type RuntimeKeyIssueFormState = RuntimeKeyPolicyDraft & {
  label: string;
  accountId: string;
  scopes: string;
};

/** One-time secret state after issue or rotation. */
export type IssuedSecretState = {
  action: "issued" | "rotated";
  key_id: string;
  label: string;
  prefix: string;
  token: string;
  account_id: string | null;
  created_at: string;
};

/** Policy validation result. */
export type PolicyValidation = {
  valid: boolean;
  errors: string[];
  policy: RuntimeKeyRequestPathPolicy;
};

// ─── Constants ────────────────────────────────────────────────────────────

/** Valid request path options. */
export const REQUEST_PATH_OPTIONS: RuntimeKeyRequestPathPolicy["allowed_request_paths"] = [
  "smart_routing",
  "pinned_target",
  "local_only",
  "queue_background",
  "blocked",
  "review_required",
];

/** Form ID for the issue key drawer. */
export const ISSUE_DRAWER_FORM_ID = "runtime-key-issue-form";

/** Default scopes for new keys. */
export const DEFAULT_SCOPES = "models:read\nchat:write\nresponses:write";
