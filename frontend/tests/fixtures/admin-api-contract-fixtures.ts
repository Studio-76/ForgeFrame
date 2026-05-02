import type { AdminSessionUser } from "../../src/api/domain";

/**
 * Canonical admin session fixture aligned with backend /admin/auth/me payload.
 */
export const adminSessionUserFixture: AdminSessionUser = {
  session_id: "sess_contract_alpha",
  user_id: "admin_contract_alpha",
  username: "ops-admin",
  display_name: "Ops Admin",
  role: "admin",
  session_type: "standard",
  read_only: false,
  must_rotate_password: false,
};

/**
 * Contract fixture for GET /admin/auth/me.
 */
export const adminSessionFixture = {
  status: "ok",
  user: adminSessionUserFixture,
} as const;

/**
 * Contract fixture for GET /admin/instances/.
 */
export const instancesFixture = {
  status: "ok",
  instances: [
    {
      instance_id: "instance_alpha",
      slug: "instance-alpha",
      display_name: "Instance Alpha",
      description: "Primary contract instance",
      status: "active",
      tenant_id: "tenant_alpha",
      company_id: "company_alpha",
      deployment_mode: "restricted_eval",
      exposure_mode: "local_only",
      is_default: true,
      metadata: { region: "us-west-1" },
      created_at: "2026-04-21T10:00:00Z",
      updated_at: "2026-04-21T10:05:00Z",
    },
  ],
} as const;

/**
 * Contract fixture for GET /admin/providers/.
 */
export const providerControlPlaneFixture = {
  status: "ok",
  object: "provider_control_plane",
  instance: {
    instance_id: "instance_alpha",
    slug: "instance-alpha",
    display_name: "Instance Alpha",
    description: "Primary contract instance",
    status: "active",
    tenant_id: "tenant_alpha",
    company_id: "company_alpha",
    deployment_mode: "restricted_eval",
    exposure_mode: "local_only",
    is_default: true,
    metadata: {},
    created_at: "2026-04-21T10:00:00Z",
    updated_at: "2026-04-21T10:05:00Z",
  },
  providers: [],
  supported_provider_classes: [],
  provider_catalog: [],
  provider_catalog_summary: {
    generated_at: "2026-04-21T10:05:00Z",
    total: 0,
    enabled: 0,
    ready: 0,
    with_models: 0,
    by_class: {},
  },
  openai_compatibility_signoff: null,
  truth_axes: [],
  health_config: {
    provider_health_enabled: true,
    model_health_enabled: true,
    interval_seconds: 300,
    probe_mode: "provider",
    selected_models: [],
  },
  bootstrap_readiness: null,
  notes: {
    sync_action: "Model sync can be triggered via POST /admin/providers/sync.",
    health_action:
      "Model health checks can be configured and triggered via /admin/providers/health endpoints.",
    harness_actions: ["preview", "dry_run", "verify", "probe", "snapshot"],
    persistence: "repository_backed_harness_profiles",
    product_axes: [
      "oauth_account_providers",
      "openai_compatible_providers",
      "local_providers",
      "openai_compatible_clients",
    ],
    truth_contract: [
      "provider_catalog",
      "provider_truth",
      "runtime_truth",
      "harness_truth",
      "ui_truth",
    ],
  },
} as const;

/**
 * Contract fixture for GET /admin/tasks.
 */
export const tasksFixture = {
  status: "ok",
  instance: {
    instance_id: "instance_alpha",
    slug: "instance-alpha",
    display_name: "Instance Alpha",
    description: "Primary contract instance",
    status: "active",
    tenant_id: "tenant_alpha",
    company_id: "company_alpha",
    deployment_mode: "restricted_eval",
    exposure_mode: "local_only",
    is_default: true,
    metadata: {},
    created_at: "2026-04-21T10:00:00Z",
    updated_at: "2026-04-21T10:05:00Z",
  },
  tasks: [
    {
      task_id: "task_alpha",
      instance_id: "instance_alpha",
      company_id: "company_alpha",
      task_kind: "task",
      title: "Rotate provider key",
      summary: "Rotate the provider key before expiry.",
      status: "open",
      priority: "high",
      owner_id: "admin_contract_alpha",
      conversation_id: null,
      inbox_id: null,
      workspace_id: null,
      due_at: "2026-04-25T10:00:00Z",
      completed_at: null,
      metadata: { source: "contract-test" },
      reminder_count: 1,
      notification_count: 0,
      created_at: "2026-04-21T10:10:00Z",
      updated_at: "2026-04-21T10:12:00Z",
    },
  ],
} as const;
