// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchLearningEventsMock,
  fetchLearningEventDetailMock,
  createLearningEventMock,
  decideLearningEventMock,
  scanLearningPatternsMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchLearningEventsMock: vi.fn(),
  fetchLearningEventDetailMock: vi.fn(),
  createLearningEventMock: vi.fn(),
  decideLearningEventMock: vi.fn(),
  scanLearningPatternsMock: vi.fn(),
}));

vi.mock("../src/api/admin/learning", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/learning")>("../src/api/admin/learning");
  return {
    ...actual,
    fetchLearningEvents: fetchLearningEventsMock,
    fetchLearningEventDetail: fetchLearningEventDetailMock,
    createLearningEvent: createLearningEventMock,
    decideLearningEvent: decideLearningEventMock,
    scanLearningPatterns: scanLearningPatternsMock,
  };
});

vi.mock("../src/api/admin/instances", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin/instances")>("../src/api/admin/instances");
  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
  };
});

import type { AdminSessionUser, LearningEventDetail, LearningEventSummary } from "../src/api/domain";
import { LearningPage } from "../src/pages/LearningPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

function createLearningSummary(overrides: Partial<LearningEventSummary> = {}): LearningEventSummary {
  return {
    learning_event_id: "learning_suggested",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    trigger_kind: "session_rotation",
    suggested_decision: "boot_memory",
    status: "pending",
    summary: "Session rotation summary candidate",
    explanation: "Review whether the session boundary should become memory.",
    agent_id: null,
    run_id: "run_alpha",
    conversation_id: "conversation_alpha",
    evidence: {
      trigger: "conversation_session_rotation",
      thread_id: "thread_alpha",
      session_id: "session_alpha",
    },
    proposed_memory: {
      memory_kind: "summary",
      title: "Session boundary summary",
      body: "Create a memory entry that captures the session rotation.",
      visibility_scope: "team",
      sensitivity: "normal",
      source_trust_class: "runtime_inferred",
    },
    proposed_skill: {},
    promoted_memory_id: null,
    promoted_skill_id: null,
    human_override: false,
    decision_note: null,
    review_bucket: "suggested",
    review_bucket_label: "Suggested",
    suggested_lane: "auto_promote",
    suggested_lane_label: "Auto promote",
    source: {
      kind: "conversation",
      label: "Conversation: Learning conversation",
      detail: "Conversation conversation_alpha · memory_usage run_alpha · thread thread_alpha · session session_alpha",
    },
    proposal: {
      target_kind: "boot_memory",
      target_label: "Promote to boot memory",
      surface: "memory",
      scope_label: "Team visibility",
      content_summary: "Session boundary summary",
      trust_label: "Runtime inferred",
    },
    outcome: {
      target_kind: null,
      target_label: "Pending operator decision",
      surface: "pending",
      scope_label: null,
    },
    risk: {
      level: "medium",
      reasons: ["Suggested boot promotion would persist startup context."],
    },
    created_at: "2026-04-23T09:00:00Z",
    decided_at: null,
    ...overrides,
  };
}

function createLearningDetail(overrides: Partial<LearningEventDetail> = {}): LearningEventDetail {
  return {
    ...createLearningSummary(),
    conversation: {
      record_id: "conversation_alpha",
      label: "Learning conversation",
      status: "open",
    },
    run: {
      record_id: "run_alpha",
      label: "memory_usage",
      status: "succeeded",
    },
    agent: null,
    promoted_memory: null,
    promoted_skill: null,
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root | null = null;

async function renderIntoDom(element: ReactNode) {
  root = createRoot(container);
  await act(async () => {
    root?.render(element);
  });
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

function setControlValue(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(control) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(new Event(control.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  });
}

function getButtonByText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll("button")).find((button) => button.textContent?.includes(text));
}

function getFormByText(text: string) {
  return Array.from(container.querySelectorAll("form")).find((form) => form.textContent?.includes(text));
}

function getLabeledControl(scope: ParentNode, labelText: string) {
  const label = Array.from(scope.querySelectorAll("label")).find((candidate) => candidate.textContent?.includes(labelText));
  if (!label) {
    throw new Error(`Label not found: ${labelText}`);
  }
  const control = label.querySelector("input, textarea, select");
  if (!control) {
    throw new Error(`Control not found for label: ${labelText}`);
  }
  return control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
}

beforeEach(() => {
  vi.resetAllMocks();

  fetchInstancesMock.mockResolvedValue({
    status: "ok",
    instances: [
      {
        instance_id: "instance_alpha",
        slug: "instance-alpha",
        display_name: "Alpha Instance",
        description: "Alpha",
        status: "active",
        tenant_id: "tenant_alpha",
        company_id: "company_alpha",
        deployment_mode: "linux_host_native",
        exposure_mode: "same_origin",
        is_default: true,
        metadata: {},
        created_at: "2026-04-23T09:00:00Z",
        updated_at: "2026-04-23T09:00:00Z",
      },
    ],
  });

  fetchLearningEventsMock.mockResolvedValue({
    status: "ok",
    instance: null,
    events: [
      createLearningSummary(),
      createLearningSummary({
        learning_event_id: "learning_review",
        status: "review_required",
        suggested_decision: "review_required",
        summary: "Pattern needs manual review",
        review_bucket: "review_required",
        review_bucket_label: "Review required",
        suggested_lane: "review_required",
        suggested_lane_label: "Review required",
        proposal: {
          target_kind: "review_required",
          target_label: "Require human review",
          surface: "review",
          scope_label: "Manual review before promotion",
          content_summary: "Pattern needs manual review",
          trust_label: null,
        },
        outcome: {
          target_kind: "review_required",
          target_label: "Require human review",
          surface: "review",
          scope_label: "Manual review before promotion",
        },
      }),
      createLearningSummary({
        learning_event_id: "learning_promoted",
        status: "applied",
        summary: "Durable memory was promoted",
        review_bucket: "approved_promoted",
        review_bucket_label: "Approved / promoted",
        outcome: {
          target_kind: "durable_memory",
          target_label: "Promote to durable memory",
          surface: "memory",
          scope_label: "Restricted visibility",
        },
        promoted_memory_id: "memory_alpha",
      }),
      createLearningSummary({
        learning_event_id: "learning_rejected",
        status: "discarded",
        summary: "Operator rejected weak signal",
        review_bucket: "rejected",
        review_bucket_label: "Rejected",
        suggested_decision: "discard",
        suggested_lane: "auto_reject",
        suggested_lane_label: "Auto reject",
        proposal: {
          target_kind: "discard",
          target_label: "Reject learning event",
          surface: "rejection",
          scope_label: "Reject and archive",
          content_summary: "Operator rejected weak signal",
          trust_label: null,
        },
        outcome: {
          target_kind: "discard",
          target_label: "Reject learning event",
          surface: "rejection",
          scope_label: "Reject and archive",
        },
        risk: {
          level: "low",
          reasons: ["Explainability payload and promotion path are low risk."],
        },
      }),
    ],
  });

  fetchLearningEventDetailMock.mockImplementation(async (eventId: string) => {
    if (eventId === "learning_manual") {
      return {
        status: "ok",
        event: createLearningDetail({
          learning_event_id: "learning_manual",
          summary: "Manual billing exception review",
          explanation: "Operators want a durable billing exception memory.",
        }),
      };
    }
    if (eventId === "learning_scanned") {
      return {
        status: "ok",
        event: createLearningDetail({
          learning_event_id: "learning_scanned",
          summary: "Repeated correction pattern: Escalation mailbox",
          trigger_kind: "pattern_detected",
        }),
      };
    }
    return {
      status: "ok",
      event: createLearningDetail(),
    };
  });

  createLearningEventMock.mockResolvedValue({
    status: "ok",
    event: createLearningDetail({
      learning_event_id: "learning_manual",
      summary: "Manual billing exception review",
      explanation: "Operators want a durable billing exception memory.",
    }),
  });

  decideLearningEventMock.mockResolvedValue({
    status: "ok",
    event: createLearningDetail({
      status: "applied",
      review_bucket: "approved_promoted",
      review_bucket_label: "Approved / promoted",
      promoted_memory_id: "memory_promoted_alpha",
      promoted_memory: {
        record_id: "memory_promoted_alpha",
        label: "Session boundary summary",
        status: "active",
      },
      outcome: {
        target_kind: "durable_memory",
        target_label: "Promote to durable memory",
        surface: "memory",
        scope_label: "Restricted visibility",
      },
    }),
  });

  scanLearningPatternsMock.mockResolvedValue({
    status: "ok",
    events: [
      createLearningSummary({
        learning_event_id: "learning_scanned",
        summary: "Repeated correction pattern: Escalation mailbox",
        trigger_kind: "pattern_detected",
        source: {
          kind: "pattern_scan",
          label: "Pattern scan: Escalation mailbox",
          detail: "2 repeated corrections",
        },
      }),
    ],
  });

  container = document.createElement("div");
  document.body.innerHTML = "";
  document.body.appendChild(container);
});

afterEach(() => {
  if (!root) {
    return;
  }
  act(() => {
    root?.unmount();
  });
  root = null;
});

describe("learning page", () => {
  it("groups learning events into review buckets and renders real detail links", async () => {
    await renderIntoDom(withAppContext({
      path: "/learning?instanceId=instance_alpha&eventId=learning_suggested",
      element: <LearningPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchLearningEventsMock).toHaveBeenCalledWith("instance_alpha", { status: "all", triggerKind: "all", limit: 100 });
    expect(fetchLearningEventDetailMock).toHaveBeenCalledWith("learning_suggested", "instance_alpha");

    expect(container.textContent).toContain("Suggested");
    expect(container.textContent).toContain("Review required");
    expect(container.textContent).toContain("Approved / promoted");
    expect(container.textContent).toContain("Rejected");
    expect(container.textContent).toContain("Session boundary summary");
    expect(container.textContent).toContain("Promote to boot memory");
    expect(container.textContent).toContain("medium risk");

    const conversationLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open conversation");
    expect(conversationLink?.getAttribute("href")).toBe("/conversations?instanceId=instance_alpha&conversationId=conversation_alpha");

    const runLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open execution review");
    expect(runLink?.getAttribute("href")).toBe("/execution?instanceId=instance_alpha&runId=run_alpha");
  });

  it("runs pattern scans, creates manual review items, and decides durable memory promotion with structured payloads", async () => {
    await renderIntoDom(withAppContext({
      path: "/learning?instanceId=instance_alpha&eventId=learning_suggested",
      element: <LearningPage />,
      session: adminSession,
    }));
    await flushEffects();

    const scanButton = getButtonByText(container, "Run pattern scan");
    await act(async () => {
      scanButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(scanLearningPatternsMock).toHaveBeenCalledWith("instance_alpha");
    expect(container.textContent).toContain("Last pattern scan result");
    expect(container.textContent).toContain("Repeated correction pattern: Escalation mailbox");

    const createForm = getFormByText("Create learning review item");
    expect(createForm).toBeTruthy();
    setControlValue(getLabeledControl(createForm!, "Suggested path"), "durable_memory");
    setControlValue(getLabeledControl(createForm!, "Summary"), "Manual billing exception review");
    setControlValue(getLabeledControl(createForm!, "Explanation"), "Operators want a durable billing exception memory.");
    setControlValue(getLabeledControl(createForm!, "Memory title"), "Billing exception policy");
    setControlValue(getLabeledControl(createForm!, "Memory body"), "Persist the billing exception rule after operator confirmation.");
    setControlValue(getLabeledControl(createForm!, "Review date"), "2026-05-30T09:00:00Z");
    setControlValue(getLabeledControl(createForm!, "Review note"), "Review inferred durable billing truth before final retention.");
    setControlValue(getLabeledControl(createForm!, "Source note"), "handoff-42");

    await act(async () => {
      createForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(createLearningEventMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      trigger_kind: "operator_action",
      summary: "Manual billing exception review",
      explanation: "Operators want a durable billing exception memory.",
      suggested_decision: "durable_memory",
      evidence: expect.objectContaining({
        source_ref: "handoff-42",
        created_from_console: true,
      }),
      proposed_memory: expect.objectContaining({
        title: "Billing exception policy",
        body: "Persist the billing exception rule after operator confirmation.",
        visibility_scope: "team",
        sensitivity: "normal",
        source_trust_class: "runtime_inferred",
        metadata: {
          review: {
            review_at: "2026-05-30T09:00:00Z",
            note: "Review inferred durable billing truth before final retention.",
          },
        },
      }),
      proposed_skill: {},
    }));

    const decisionForm = getFormByText("Decision path");
    expect(decisionForm).toBeTruthy();
    setControlValue(getLabeledControl(decisionForm!, "Decision path"), "durable_memory");
    setControlValue(getLabeledControl(decisionForm!, "Decision note"), "Promote after human review.");
    setControlValue(getLabeledControl(decisionForm!, "Visibility"), "restricted");
    setControlValue(getLabeledControl(decisionForm!, "Sensitivity"), "restricted");
    setControlValue(getLabeledControl(decisionForm!, "Memory title"), "Session boundary summary corrected");
    setControlValue(getLabeledControl(decisionForm!, "Memory body"), "Promote this session boundary into durable memory.");

    await act(async () => {
      decisionForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(decideLearningEventMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Durable memory promoted from runtime-inferred or external-unverified trust requires a review date.");

    setControlValue(getLabeledControl(decisionForm!, "Review date"), "2026-05-31T09:00:00Z");
    setControlValue(getLabeledControl(decisionForm!, "Review note"), "Verify durable promotion after human review.");

    await act(async () => {
      decisionForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(decideLearningEventMock).toHaveBeenCalledWith("instance_alpha", "learning_suggested", expect.objectContaining({
      decision: "durable_memory",
      decision_note: "Promote after human review.",
      human_override: false,
      memory_payload: expect.objectContaining({
        title: "Session boundary summary corrected",
        body: "Promote this session boundary into durable memory.",
        visibility_scope: "restricted",
        sensitivity: "restricted",
        source_trust_class: "runtime_inferred",
        metadata: {
          review: {
            review_at: "2026-05-31T09:00:00Z",
            note: "Verify durable promotion after human review.",
          },
        },
      }),
      skill_payload: {},
    }));
  });
});
