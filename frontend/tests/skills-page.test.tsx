// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchAgentsMock,
  fetchSkillsMock,
  fetchSkillDetailMock,
  createSkillMock,
  updateSkillMock,
  activateSkillMock,
  archiveSkillMock,
  recordSkillUsageMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchAgentsMock: vi.fn(),
  fetchSkillsMock: vi.fn(),
  fetchSkillDetailMock: vi.fn(),
  createSkillMock: vi.fn(),
  updateSkillMock: vi.fn(),
  activateSkillMock: vi.fn(),
  archiveSkillMock: vi.fn(),
  recordSkillUsageMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchAgents: fetchAgentsMock,
    fetchSkills: fetchSkillsMock,
    fetchSkillDetail: fetchSkillDetailMock,
    createSkill: createSkillMock,
    updateSkill: updateSkillMock,
    activateSkill: activateSkillMock,
    archiveSkill: archiveSkillMock,
    recordSkillUsage: recordSkillUsageMock,
  };
});

import type { AdminSessionUser, SkillDetail, SkillSummary } from "../src/api/admin";
import { SkillsPage } from "../src/pages/SkillsPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

function createSkillSummary(overrides: Partial<SkillSummary> = {}): SkillSummary {
  return {
    skill_id: "skill_review_alpha",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    display_name: "Review Pricing Reply",
    summary: "Review outbound pricing responses before send.",
    scope: "agent",
    scope_label: "Agent scope · Skill Reviewer",
    scope_agent_id: "agent_skill_reviewer",
    current_version_number: 2,
    status: "review",
    approval: {
      posture: "review_required",
      label: "Review required",
      note: "This skill is waiting for approval or operator review before active use.",
    },
    provenance: {
      learning_event_id: "learning_alpha",
      note: "Promoted from learning.",
    },
    provenance_summary: {
      kind: "learning",
      label: "Promoted from learning",
      detail: "learning event learning_alpha",
    },
    activation_conditions: {
      preview_required: true,
      channel: "email",
      note: "Require reviewer preview before send.",
    },
    instruction_core: "Review the draft pricing reply for policy and tone.",
    telemetry: {
      usage_count: 5,
      last_outcome: "blocked",
      success_count: 3,
      blocked_count: 2,
      error_count: 0,
    },
    telemetry_summary: {
      usage_count: 5,
      last_outcome: "blocked",
      success_count: 3,
      blocked_count: 2,
      error_count: 0,
    },
    metadata: {
      tier: "review",
    },
    last_used_at: "2026-04-23T11:00:00Z",
    active_activation_count: 1,
    active_scope_labels: ["Agent scope · Skill Reviewer"],
    last_outcome: "blocked",
    created_at: "2026-04-23T09:00:00Z",
    updated_at: "2026-04-23T10:00:00Z",
    ...overrides,
  };
}

function createSkillDetail(overrides: Partial<SkillDetail> = {}): SkillDetail {
  return {
    ...createSkillSummary(),
    scope_agent: {
      record_id: "agent_skill_reviewer",
      label: "Skill Reviewer",
      status: "active",
    },
    versions: [
      {
        version_id: "skillver_2",
        skill_id: "skill_review_alpha",
        instance_id: "instance_alpha",
        company_id: "company_alpha",
        version_number: 2,
        status: "review",
        summary: "Review pricing responses and block unsafe sends.",
        instruction_core: "Review the draft pricing reply, block unsafe content, and explain the decision.",
        provenance: {
          learning_event_id: "learning_alpha",
        },
        activation_conditions: {
          preview_required: true,
          channel: "email",
        },
        metadata: {},
        created_at: "2026-04-23T10:00:00Z",
      },
      {
        version_id: "skillver_1",
        skill_id: "skill_review_alpha",
        instance_id: "instance_alpha",
        company_id: "company_alpha",
        version_number: 1,
        status: "draft",
        summary: "Review outbound pricing responses before send.",
        instruction_core: "Review the draft pricing reply for policy and tone.",
        provenance: {
          source: "operator",
        },
        activation_conditions: {
          channel: "email",
        },
        metadata: {},
        created_at: "2026-04-23T09:00:00Z",
      },
    ],
    activations: [
      {
        activation_id: "skillact_alpha",
        skill_id: "skill_review_alpha",
        version_id: "skillver_2",
        instance_id: "instance_alpha",
        company_id: "company_alpha",
        scope: "agent",
        scope_label: "Agent scope · Skill Reviewer",
        scope_agent_id: "agent_skill_reviewer",
        status: "active",
        activation_conditions: {
          preview_required: true,
          channel: "email",
        },
        activated_by_type: "user",
        activated_by_id: "user-admin",
        activated_at: "2026-04-23T10:15:00Z",
        deactivated_at: null,
        metadata: {
          activation_source: "test",
        },
      },
    ],
    recent_usage: [
      {
        usage_event_id: "skilluse_alpha",
        skill_id: "skill_review_alpha",
        version_id: "skillver_2",
        version_number: 2,
        activation_id: "skillact_alpha",
        instance_id: "instance_alpha",
        company_id: "company_alpha",
        agent_id: "agent_skill_reviewer",
        run_id: "run_alpha",
        conversation_id: "conversation_alpha",
        outcome: "blocked",
        details: {
          decision: "block",
          note: "Blocked because the reply leaked restricted pricing.",
        },
        created_at: "2026-04-23T11:00:00Z",
      },
    ],
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

function getFormByText(text: string) {
  return Array.from(container.querySelectorAll("form")).find((form) => form.textContent?.includes(text));
}

function getButtonByText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll("button")).find((button) => button.textContent?.includes(text));
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

  fetchAgentsMock.mockResolvedValue({
    status: "ok",
    instance: null,
    agents: [
      {
        agent_id: "agent_skill_reviewer",
        instance_id: "instance_alpha",
        company_id: "company_alpha",
        display_name: "Skill Reviewer",
        role_kind: "reviewer",
        participation_mode: "direct",
        allowed_targets: ["conversation", "skill"],
        status: "active",
        metadata: {},
        created_at: "2026-04-23T09:00:00Z",
        updated_at: "2026-04-23T09:00:00Z",
      },
    ],
  });

  fetchSkillsMock.mockResolvedValue({
    status: "ok",
    instance: null,
    skills: [
      createSkillSummary(),
    ],
  });

  fetchSkillDetailMock.mockResolvedValue({
    status: "ok",
    skill: createSkillDetail(),
  });

  createSkillMock.mockResolvedValue({
    status: "ok",
    skill: createSkillDetail({
      skill_id: "skill_review_beta",
      display_name: "Review Escalation Reply",
    }),
  });

  updateSkillMock.mockResolvedValue({
    status: "ok",
    skill: createSkillDetail({
      display_name: "Review Pricing Reply Updated",
      summary: "Updated skill summary",
    }),
  });

  activateSkillMock.mockResolvedValue({
    status: "ok",
    skill: createSkillDetail({
      status: "active",
      approval: {
        posture: "approved",
        label: "Approved / active",
        note: "This skill has cleared review and currently participates in activation state.",
      },
      last_outcome: "success",
      telemetry: {
        usage_count: 5,
        last_outcome: "success",
        success_count: 4,
        blocked_count: 1,
        error_count: 0,
      },
      telemetry_summary: {
        usage_count: 5,
        last_outcome: "success",
        success_count: 4,
        blocked_count: 1,
        error_count: 0,
      },
    }),
  });

  archiveSkillMock.mockResolvedValue({
    status: "ok",
    skill: createSkillDetail({
      status: "archived",
      approval: {
        posture: "archived",
        label: "Archived",
        note: "Archiving keeps versions and telemetry but removes the skill from active use.",
      },
      activations: [
        {
          ...createSkillDetail().activations[0],
          status: "archived",
          deactivated_at: "2026-04-23T12:00:00Z",
        },
      ],
    }),
  });

  recordSkillUsageMock.mockResolvedValue({
    status: "ok",
    skill: createSkillDetail({
      telemetry: {
        usage_count: 6,
        last_outcome: "success",
        success_count: 4,
        blocked_count: 2,
        error_count: 0,
      },
      telemetry_summary: {
        usage_count: 6,
        last_outcome: "success",
        success_count: 4,
        blocked_count: 2,
        error_count: 0,
      },
      last_outcome: "success",
      recent_usage: [
        {
          ...createSkillDetail().recent_usage[0],
          outcome: "success",
          details: {
            decision: "allow",
            note: "Allowed after policy review.",
          },
        },
      ],
    }),
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

describe("skills page", () => {
  it("renders a real skill registry with provenance, approval posture, and telemetry", async () => {
    await renderIntoDom(withAppContext({
      path: "/skills?instanceId=instance_alpha&skillId=skill_review_alpha",
      element: <SkillsPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchSkillsMock).toHaveBeenCalledWith("instance_alpha", { status: "all", scope: "all", limit: 100 });
    expect(fetchSkillDetailMock).toHaveBeenCalledWith("skill_review_alpha", "instance_alpha");
    expect(container.textContent).toContain("Skill registry");
    expect(container.textContent).toContain("Review Pricing Reply");
    expect(container.textContent).toContain("Promoted from learning");
    expect(container.textContent).toContain("Review required");
    expect(container.textContent).toContain("Agent scope · Skill Reviewer");
    expect(container.textContent).toContain("5 recorded uses");

    const learningLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open learning event");
    expect(learningLink?.getAttribute("href")).toBe("/learning?instanceId=instance_alpha&eventId=learning_alpha");

    const agentLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Open scope agent");
    expect(agentLink?.getAttribute("href")).toBe("/agents?instanceId=instance_alpha&agentId=agent_skill_reviewer");
  });

  it("creates, updates, activates, archives, and records skill usage with structured registry payloads", async () => {
    await renderIntoDom(withAppContext({
      path: "/skills?instanceId=instance_alpha&skillId=skill_review_alpha",
      element: <SkillsPage />,
      session: adminSession,
    }));
    await flushEffects();

    const createForm = getFormByText("Create registry entry");
    expect(createForm).toBeTruthy();
    setControlValue(getLabeledControl(createForm!, "Display name"), "Review Escalation Reply");
    setControlValue(getLabeledControl(createForm!, "Scope"), "agent");
    setControlValue(getLabeledControl(createForm!, "Scope agent"), "agent_skill_reviewer");
    setControlValue(getLabeledControl(createForm!, "Instruction core"), "Review escalation replies before sending them.");
    setControlValue(getLabeledControl(createForm!, "Origin"), "learning");
    setControlValue(getLabeledControl(createForm!, "Learning event ID"), "learning_beta");
    setControlValue(getLabeledControl(createForm!, "Preview required"), "yes");
    setControlValue(getLabeledControl(createForm!, "Channel hint"), "slack");

    await act(async () => {
      createForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(createSkillMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      display_name: "Review Escalation Reply",
      scope: "agent",
      scope_agent_id: "agent_skill_reviewer",
      instruction_core: "Review escalation replies before sending them.",
      provenance: expect.objectContaining({
        learning_event_id: "learning_beta",
      }),
      activation_conditions: expect.objectContaining({
        preview_required: true,
        channel: "slack",
      }),
    }));

    const updateForm = getFormByText("Save registry entry");
    expect(updateForm).toBeTruthy();
    setControlValue(getLabeledControl(updateForm!, "Display name"), "Review Pricing Reply Updated");
    setControlValue(getLabeledControl(updateForm!, "Scope"), "instance");
    setControlValue(getLabeledControl(updateForm!, "Scope agent"), "");
    setControlValue(getLabeledControl(updateForm!, "Note"), "Updated from operator review.");

    await act(async () => {
      updateForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(updateSkillMock).toHaveBeenCalledWith("instance_alpha", "skill_review_alpha", expect.objectContaining({
      display_name: "Review Pricing Reply Updated",
      scope: "instance",
      scope_agent_id: null,
      provenance: expect.objectContaining({
        learning_event_id: "learning_alpha",
        note: "Updated from operator review.",
      }),
    }));

    const activateForm = getFormByText("Activate skill version");
    expect(activateForm).toBeTruthy();
    setControlValue(getLabeledControl(activateForm!, "Version"), "skillver_1");
    setControlValue(getLabeledControl(activateForm!, "Scope"), "instance");
    setControlValue(getLabeledControl(activateForm!, "Preview required"), "no");
    setControlValue(getLabeledControl(activateForm!, "Channel hint"), "email");

    await act(async () => {
      activateForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(activateSkillMock).toHaveBeenCalledWith("instance_alpha", "skill_review_alpha", expect.objectContaining({
      version_id: "skillver_1",
      scope: "instance",
      scope_agent_id: null,
      activation_conditions: expect.objectContaining({
        channel: "email",
      }),
    }));

    const archiveButton = getButtonByText(container, "Archive skill");
    await act(async () => {
      archiveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(archiveSkillMock).toHaveBeenCalledWith("instance_alpha", "skill_review_alpha");

    const usageForm = getFormByText("Record usage");
    expect(usageForm).toBeTruthy();
    setControlValue(getLabeledControl(usageForm!, "Run ID"), "run_usage_alpha");
    setControlValue(getLabeledControl(usageForm!, "Conversation ID"), "conversation_usage_alpha");
    setControlValue(getLabeledControl(usageForm!, "Outcome"), "success");
    setControlValue(getLabeledControl(usageForm!, "Decision"), "allow");
    setControlValue(getLabeledControl(usageForm!, "Usage note"), "Allowed after manual review.");

    await act(async () => {
      usageForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(recordSkillUsageMock).toHaveBeenCalledWith("instance_alpha", "skill_review_alpha", expect.objectContaining({
      run_id: "run_usage_alpha",
      conversation_id: "conversation_usage_alpha",
      outcome: "success",
      details: expect.objectContaining({
        decision: "allow",
        note: "Allowed after manual review.",
      }),
    }));
  });
});
