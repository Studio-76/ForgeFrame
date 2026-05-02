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

vi.mock("../src/api/domain", async () => {
  const actual = await vi.importActual<typeof import("../src/api/domain")>("../src/api/domain");

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

import type { AdminSessionUser, SkillDetail, SkillSummary } from "../src/api/domain";
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
    scope_label: "Agent scope \u00b7 Skill Reviewer",
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
    active_scope_labels: ["Agent scope \u00b7 Skill Reviewer"],
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
        scope_label: "Agent scope \u00b7 Skill Reviewer",
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

function setControlValue(
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) {
  const prototype = Object.getPrototypeOf(control) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  act(() => {
    setter?.call(control, value);
    control.dispatchEvent(
      new Event(control.tagName === "SELECT" ? "change" : "input", { bubbles: true }),
    );
  });
}

function getButtonByText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  );
}

function getDetailsByText(scope: ParentNode, text: string) {
  return Array.from(scope.querySelectorAll("details")).find((details) =>
    details.textContent?.includes(text),
  );
}

function getLabeledControl(scope: ParentNode, labelText: string) {
  const label = Array.from(scope.querySelectorAll("label")).find((candidate) =>
    candidate.textContent?.includes(labelText),
  );
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
    skills: [createSkillSummary()],
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
  it("renders summary hero, registry table, and skill detail with lifecycle state", async () => {
    await renderIntoDom(
      withAppContext({
        path: "/skills?instanceId=instance_alpha&skillId=skill_review_alpha",
        element: <SkillsPage />,
        session: adminSession,
      }),
    );
    await flushEffects();

    // Verify API calls
    expect(fetchSkillsMock).toHaveBeenCalledWith("instance_alpha", {
      status: "all",
      scope: "all",
      limit: 100,
    });
    expect(fetchSkillDetailMock).toHaveBeenCalledWith(
      "skill_review_alpha",
      "instance_alpha",
    );

    // Verify summary hero shows counts
    expect(container.textContent).toContain("1 skill registered");
    expect(container.textContent).toContain("Pending review");
    expect(container.textContent).toContain("Needs attention");
    expect(container.textContent).toContain("Attention required");

    // Verify table shows the skill
    expect(container.textContent).toContain("Review Pricing Reply");
    expect(container.textContent).toContain("Promoted from learning");

    // Verify detail panel shows lifecycle info
    expect(container.textContent).toContain("Pending review");
    expect(container.textContent).toContain("Review and approve before activation");

    // Verify navigation links in provenance
    const learningLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent === "Open learning event",
    );
    expect(learningLink?.getAttribute("href")).toBe(
      "/learning?instanceId=instance_alpha&eventId=learning_alpha",
    );

    const agentLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent === "Open scope agent",
    );
    expect(agentLink?.getAttribute("href")).toBe(
      "/agents?instanceId=instance_alpha&agentId=agent_skill_reviewer",
    );
  });

  it("creates a new skill through the guided creation flow", async () => {
    await renderIntoDom(
      withAppContext({
        path: "/skills?instanceId=instance_alpha",
        element: <SkillsPage />,
        session: adminSession,
      }),
    );
    await flushEffects();

    // Click "Create skill" button in summary hero
    const createBtn = getButtonByText(container, "Create skill");
    expect(createBtn).toBeTruthy();
    await act(async () => {
      createBtn?.click();
    });
    await flushEffects();

    // Verify the create panel is now visible
    expect(container.textContent).toContain("New skill");
    expect(container.textContent).toContain("Save draft");

    // Find the create form
    const createPanel = container.querySelector(".ff-skills-create-form") as HTMLFormElement;
    expect(createPanel).toBeTruthy();

    // Fill out required fields
    setControlValue(getLabeledControl(createPanel, "Skill name"), "Review Escalation Reply");
    setControlValue(getLabeledControl(createPanel, "Scope"), "agent");
    setControlValue(getLabeledControl(createPanel, "Scope agent"), "agent_skill_reviewer");
    setControlValue(getLabeledControl(createPanel, "Instruction core"), "Review escalation replies before sending them.");

    // Open provenance section and fill
    const provenanceDetails = getDetailsByText(createPanel, "Provenance (optional)");
    if (provenanceDetails) {
      await act(async () => {
        provenanceDetails.open = true;
      });
    }
    setControlValue(getLabeledControl(createPanel, "Origin"), "learning");
    setControlValue(getLabeledControl(createPanel, "Learning event ID"), "learning_beta");

    // Open activation rules and fill
    const activationDetails = getDetailsByText(createPanel, "Activation rules (optional)");
    if (activationDetails) {
      await act(async () => {
        activationDetails.open = true;
      });
    }
    setControlValue(getLabeledControl(createPanel, "Preview required"), "yes");
    setControlValue(getLabeledControl(createPanel, "Preferred channel"), "slack");

    // Submit the create form
    const submitBtn = getButtonByText(createPanel, "Save draft");
    expect(submitBtn).toBeTruthy();

    await act(async () => {
      createPanel.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    // Verify the API was called with correct payload
    expect(createSkillMock).toHaveBeenCalledWith(
      "instance_alpha",
      expect.objectContaining({
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
      }),
    );
  });

  it("updates, activates, archives, and records skill usage", async () => {
    await renderIntoDom(
      withAppContext({
        path: "/skills?instanceId=instance_alpha&skillId=skill_review_alpha",
        element: <SkillsPage />,
        session: adminSession,
      }),
    );
    await flushEffects();

    // ── Update ──
    // Open the "Edit skill" details section in the detail panel
    const editDetails = getDetailsByText(container, "Edit skill");
    expect(editDetails).toBeTruthy();
    await act(async () => {
      editDetails!.open = true;
    });
    await flushEffects();

    setControlValue(getLabeledControl(editDetails!, "Display name"), "Review Pricing Reply Updated");
    setControlValue(getLabeledControl(editDetails!, "Scope"), "instance");
    setControlValue(getLabeledControl(editDetails!, "Scope agent"), "None");
    setControlValue(
      getLabeledControl(editDetails!, "Note"),
      "Updated from operator review.",
    );

    const saveChangesBtn = getButtonByText(editDetails!, "Save changes");
    expect(saveChangesBtn).toBeTruthy();
    const editForm = editDetails!.querySelector("form");
    expect(editForm).toBeTruthy();

    await act(async () => {
      editForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(updateSkillMock).toHaveBeenCalledWith(
      "instance_alpha",
      "skill_review_alpha",
      expect.objectContaining({
        display_name: "Review Pricing Reply Updated",
        scope: "instance",
        scope_agent_id: null,
        provenance: expect.objectContaining({
          learning_event_id: "learning_alpha",
          note: "Updated from operator review.",
        }),
      }),
    );

    // ── Activate ──
    // Find the lifecycle activate section
    const activateBtn = getButtonByText(container, "Activate skill");
    expect(activateBtn).toBeTruthy();

    // Set version and scope in the activate fields
    const lifecycleSection = container.querySelector(".ff-skills-lifecycle-actions");
    expect(lifecycleSection).toBeTruthy();
    const versionSelects = lifecycleSection!.querySelectorAll("select");
    if (versionSelects.length >= 1) {
      setControlValue(versionSelects[0], "skillver_1");
    }
    if (versionSelects.length >= 2) {
      setControlValue(versionSelects[1], "instance");
    }

    const activateForm = activateBtn?.closest("form");
    expect(activateForm).toBeTruthy();

    await act(async () => {
      activateForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(activateSkillMock).toHaveBeenCalledWith(
      "instance_alpha",
      "skill_review_alpha",
      expect.objectContaining({
        version_id: "skillver_1",
        scope: "instance",
        scope_agent_id: null,
      }),
    );

    // ── Archive ──
    const archiveBtn = getButtonByText(container, "Archive skill");
    expect(archiveBtn).toBeTruthy();

    await act(async () => {
      archiveBtn?.click();
    });
    await flushEffects();

    expect(archiveSkillMock).toHaveBeenCalledWith("instance_alpha", "skill_review_alpha");

    // ── Record usage ──
    const usageDetails = getDetailsByText(container, "Record usage event");
    expect(usageDetails).toBeTruthy();
    await act(async () => {
      usageDetails!.open = true;
    });
    await flushEffects();

    setControlValue(getLabeledControl(usageDetails!, "Run ID"), "run_usage_alpha");
    setControlValue(getLabeledControl(usageDetails!, "Conversation ID"), "conversation_usage_alpha");
    setControlValue(getLabeledControl(usageDetails!, "Outcome"), "success");
    setControlValue(getLabeledControl(usageDetails!, "Decision"), "allow");
    setControlValue(getLabeledControl(usageDetails!, "Usage note"), "Allowed after manual review.");

    const recordBtn = getButtonByText(usageDetails!, "Record usage");
    expect(recordBtn).toBeTruthy();
    const usageForm = usageDetails!.querySelector("form");
    expect(usageForm).toBeTruthy();

    await act(async () => {
      usageForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flushEffects();

    expect(recordSkillUsageMock).toHaveBeenCalledWith(
      "instance_alpha",
      "skill_review_alpha",
      expect.objectContaining({
        run_id: "run_usage_alpha",
        conversation_id: "conversation_usage_alpha",
        outcome: "success",
        details: expect.objectContaining({
          decision: "allow",
          note: "Allowed after manual review.",
        }),
      }),
    );
  });

  it("shows empty state when no skills exist", async () => {
    fetchSkillsMock.mockResolvedValue({
      status: "ok",
      instance: null,
      skills: [],
    });

    await renderIntoDom(
      withAppContext({
        path: "/skills?instanceId=instance_alpha",
        element: <SkillsPage />,
        session: adminSession,
      }),
    );
    await flushEffects();

    // Verify empty state is shown
    expect(container.textContent).toContain("No skills are registered for this scope");
    expect(container.textContent).toContain("Create skill");

    // Verify summary shows zero state
    expect(container.textContent).toContain("No skills registered");
  });
});
