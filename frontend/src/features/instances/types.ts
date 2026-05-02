/**
 * Feature-specific types for the Instances management page.
 *
 * @packageDocumentation
 */

import type {
  InstanceRecord,
  InstanceSetupStatus,
} from "../../api/domain/instances";

/** Load state for async operations. */
export type LoadState = "idle" | "loading" | "success" | "error";

/** Filter for instance status. */
export type StatusFilter = InstanceRecord["status"] | "all";

/** Filter for deployment mode. */
export type ModeFilter = InstanceRecord["deployment_mode"] | "all";

/** Filter for readiness status. */
export type ReadinessFilter = InstanceSetupStatus | "all";

/** Result of instance creation. */
export type CreateResult = {
  /** The created instance ID. */
  instanceId: string;
  /** The created instance display name. */
  displayName: string;
  /** Whether an operator agent was auto-created. */
  operatorCreated: boolean;
  /** The operator agent name if created. */
  operatorName: string | null;
};

/** A single blocker or check item in the remediation checklist. */
export type BlockerItem = {
  /** Unique check identifier. */
  id: string;
  /** Human-readable check label. */
  label: string;
  /** Readiness status value. */
  status: InstanceSetupStatus;
  /** Explanation of the check state. */
  detail: string;
  /** Whether this check is blocking readiness. */
  isBlocking: boolean;
  /** Link path for the remediation action, if available. */
  actionPath: string | null;
  /** Label for the remediation action link, if available. */
  actionLabel: string | null;
};

/** Default empty create form values. */
export const DEFAULT_CREATE_FORM = {
  instance_id: "",
  display_name: "",
  description: "",
  tenant_id: "",
  company_id: "",
  deployment_mode: "linux_host_native" as InstanceRecord["deployment_mode"],
  exposure_mode: "same_origin" as InstanceRecord["exposure_mode"],
};
