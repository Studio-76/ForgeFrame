// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchInstancesMock,
  fetchAssistantProfilesMock,
  fetchAssistantProfileDetailMock,
  createAssistantProfileMock,
  updateAssistantProfileMock,
  evaluateAssistantActionMock,
} = vi.hoisted(() => ({
  fetchInstancesMock: vi.fn(),
  fetchAssistantProfilesMock: vi.fn(),
  fetchAssistantProfileDetailMock: vi.fn(),
  createAssistantProfileMock: vi.fn(),
  updateAssistantProfileMock: vi.fn(),
  evaluateAssistantActionMock: vi.fn(),
}));

vi.mock("../src/api/admin", async () => {
  const actual = await vi.importActual<typeof import("../src/api/admin")>("../src/api/admin");

  return {
    ...actual,
    fetchInstances: fetchInstancesMock,
    fetchAssistantProfiles: fetchAssistantProfilesMock,
    fetchAssistantProfileDetail: fetchAssistantProfileDetailMock,
    createAssistantProfile: createAssistantProfileMock,
    updateAssistantProfile: updateAssistantProfileMock,
    evaluateAssistantAction: evaluateAssistantActionMock,
  };
});

import type { AdminSessionUser, AssistantProfileDetail, AssistantProfileSummary } from "../src/api/admin";
import { AssistantProfilesPage } from "../src/pages/AssistantProfilesPage";
import { withAppContext } from "./testContext";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const adminSession: AdminSessionUser = {
  session_id: "session-admin",
  user_id: "user-admin",
  username: "admin",
  display_name: "Admin",
  role: "admin",
};

function createProfileSummary(overrides: Partial<AssistantProfileSummary> = {}): AssistantProfileSummary {
  return {
    assistant_profile_id: "assistant_profile_primary",
    instance_id: "instance_alpha",
    company_id: "company_alpha",
    display_name: "Primary assistant profile",
    summary: "Personal assistant mode for the instance owner.",
    status: "active",
    assistant_mode_enabled: true,
    is_default: true,
    timezone: "UTC",
    locale: "de-DE",
    tone: "warm",
    preferred_contact_id: "contact_alpha",
    primary_channel_id: "channel_primary",
    fallback_channel_id: "channel_backup",
    mail_source_id: "source_mail_primary",
    calendar_source_id: "source_calendar_primary",
    metadata: {},
    created_at: "2026-04-23T09:00:00Z",
    updated_at: "2026-04-23T10:00:00Z",
    ...overrides,
  };
}

function createProfileDetail(overrides: Partial<AssistantProfileDetail> = {}): AssistantProfileDetail {
  return {
    ...createProfileSummary(),
    preferred_contact: {
      record_id: "contact_alpha",
      label: "Jordan Contact",
      status: "active",
    },
    delegate_contact: {
      record_id: "contact_delegate",
      label: "Morgan Delegate",
      status: "active",
    },
    escalation_contact: {
      record_id: "contact_escalation",
      label: "Casey Escalation",
      status: "active",
    },
    primary_channel: {
      record_id: "channel_primary",
      label: "Personal email",
      status: "active",
    },
    fallback_channel: {
      record_id: "channel_backup",
      label: "Backup email",
      status: "active",
    },
    mail_source: {
      record_id: "source_mail_primary",
      label: "Private mailbox",
      status: "active",
    },
    calendar_source: {
      record_id: "source_calendar_primary",
      label: "Primary calendar",
      status: "active",
    },
    preferences: { language: "de" },
    communication_rules: {
      tone: "warm",
      locale: "de-DE",
      signature: "Jordan",
      style_notes: null,
    },
    quiet_hours: {
      enabled: true,
      timezone: "UTC",
      start_minute: 1320,
      end_minute: 420,
      days: ["mon", "tue", "wed", "thu", "fri"],
      allow_priority_override: true,
      override_min_priority: "critical",
    },
    delivery_preferences: {
      primary_channel_id: "channel_primary",
      fallback_channel_id: "channel_backup",
      allowed_channel_ids: ["channel_primary", "channel_backup"],
      preview_by_default: true,
      mute_during_quiet_hours: true,
    },
    action_policies: {
      suggestions_enabled: true,
      questions_enabled: true,
      direct_action_policy: "preview_required",
      allow_mail_actions: true,
      allow_calendar_actions: false,
      allow_task_actions: true,
      require_approval_reference: true,
      direct_channel_ids: ["channel_primary"],
    },
    delegation_rules: {
      delegate_contact_id: "contact_delegate",
      escalation_contact_id: "contact_escalation",
      allow_external_delegation: true,
      allow_auto_followups: true,
    },
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
  setter?.call(control, value);
  control.dispatchEvent(new Event(control.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
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

  fetchAssistantProfilesMock.mockResolvedValue({
    status: "ok",
    instance: null,
    profiles: [createProfileSummary()],
  });
  fetchAssistantProfileDetailMock.mockResolvedValue({
    status: "ok",
    profile: createProfileDetail(),
  });
  createAssistantProfileMock.mockResolvedValue({
    status: "ok",
    profile: createProfileDetail({
      assistant_profile_id: "assistant_profile_beta",
      display_name: "Backup assistant profile",
    }),
  });
  updateAssistantProfileMock.mockResolvedValue({
    status: "ok",
    profile: createProfileDetail({
      display_name: "Primary assistant profile updated",
      status: "paused",
    }),
  });
  evaluateAssistantActionMock.mockResolvedValue({
    status: "ok",
    evaluation: {
      assistant_profile_id: "assistant_profile_primary",
      decision: "requires_preview",
      action_mode: "direct",
      action_kind: "send_notification",
      priority: "critical",
      evaluated_at: "2026-04-23T11:00:00Z",
      effective_channel_id: "channel_primary",
      fallback_channel_id: "channel_backup",
      quiet_hours_active: true,
      preview_required: true,
      approval_required: false,
      delegate_contact_id: "contact_delegate",
      reasons: ["quiet_hours_priority_override"],
      metadata: {},
    },
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

describe("assistant profiles page", () => {
  it("renders assistant-profile detail with linked records", async () => {
    await renderIntoDom(withAppContext({
      path: "/assistant-profiles?instanceId=instance_alpha&assistantProfileId=assistant_profile_primary",
      element: <AssistantProfilesPage />,
      session: adminSession,
    }));
    await flushEffects();

    expect(fetchAssistantProfilesMock).toHaveBeenCalledWith("instance_alpha", { status: "all", limit: 100 });
    expect(fetchAssistantProfileDetailMock).toHaveBeenCalledWith("assistant_profile_primary", "instance_alpha");
    expect(container.textContent).toContain("Primary assistant profile");
    expect(container.textContent).toContain("Direct-action policy");

    const primaryChannelLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Personal email");
    expect(primaryChannelLink?.getAttribute("href")).toBe("/channels?instanceId=instance_alpha&channelId=channel_primary");
  });

  it("creates, updates, and evaluates assistant profiles against the selected instance scope", async () => {
    await renderIntoDom(withAppContext({
      path: "/assistant-profiles?instanceId=instance_alpha&assistantProfileId=assistant_profile_primary",
      element: <AssistantProfilesPage />,
      session: adminSession,
    }));
    await flushEffects();

    const createForm = getFormByText("Create assistant profile");
    const editForm = getFormByText("Save assistant profile");
    const evaluateForm = getFormByText("Evaluate assistant action");

    const createButton = getButtonByText(createForm!, "Create assistant profile");

    await act(async () => {
      setControlValue(getLabeledControl(createForm!, "Assistant profile ID"), "assistant_profile_beta");
      setControlValue(getLabeledControl(createForm!, "Display name"), "Backup assistant profile");
      setControlValue(getLabeledControl(createForm!, "Status"), "active");
      setControlValue(getLabeledControl(createForm!, "Summary"), "Backup personal assistant profile.");
      setControlValue(getLabeledControl(createForm!, "Assistant mode enabled"), "yes");
      setControlValue(getLabeledControl(createForm!, "Default profile"), "yes");
      setControlValue(getLabeledControl(createForm!, "Tone"), "direct");
      setControlValue(getLabeledControl(createForm!, "Timezone"), "Europe/Berlin");
      setControlValue(getLabeledControl(createForm!, "Locale"), "de-DE");
      setControlValue(getLabeledControl(createForm!, "Preferred contact ID"), "contact_alpha");
      setControlValue(getLabeledControl(createForm!, "Mail source ID"), "source_mail_primary");
      setControlValue(getLabeledControl(createForm!, "Calendar source ID"), "source_calendar_primary");
      setControlValue(getLabeledControl(createForm!, "Preferences JSON"), "{\"language\":\"de\"}");
      setControlValue(getLabeledControl(createForm!, "Communication rules JSON"), "{\"tone\":\"direct\",\"locale\":\"de-DE\"}");
      setControlValue(getLabeledControl(createForm!, "Quiet hours JSON"), "{\"enabled\":true,\"timezone\":\"UTC\",\"start_minute\":0,\"end_minute\":0,\"days\":[\"mon\"]}");
      setControlValue(getLabeledControl(createForm!, "Delivery preferences JSON"), "{\"primary_channel_id\":\"channel_primary\",\"allowed_channel_ids\":[\"channel_primary\"]}");
      setControlValue(getLabeledControl(createForm!, "Action policies JSON"), "{\"direct_action_policy\":\"preview_required\",\"direct_channel_ids\":[\"channel_primary\"]}");
      setControlValue(getLabeledControl(createForm!, "Delegation rules JSON"), "{\"delegate_contact_id\":\"contact_delegate\",\"allow_external_delegation\":true}");
      setControlValue(getLabeledControl(createForm!, "Metadata JSON"), "{\"mode\":\"personal\"}");
      createButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(createAssistantProfileMock).toHaveBeenCalledWith("instance_alpha", expect.objectContaining({
      assistant_profile_id: "assistant_profile_beta",
      display_name: "Backup assistant profile",
      summary: "Backup personal assistant profile.",
      status: "active",
      assistant_mode_enabled: true,
      is_default: true,
      tone: "direct",
      timezone: "Europe/Berlin",
      locale: "de-DE",
      preferred_contact_id: "contact_alpha",
      mail_source_id: "source_mail_primary",
      calendar_source_id: "source_calendar_primary",
      preferences: { language: "de" },
      communication_rules: { tone: "direct", locale: "de-DE" },
      quiet_hours: { enabled: true, timezone: "UTC", start_minute: 0, end_minute: 0, days: ["mon"] },
      delivery_preferences: { primary_channel_id: "channel_primary", allowed_channel_ids: ["channel_primary"] },
      action_policies: { direct_action_policy: "preview_required", direct_channel_ids: ["channel_primary"] },
      delegation_rules: { delegate_contact_id: "contact_delegate", allow_external_delegation: true },
      metadata: { mode: "personal" },
    }));

    const editButton = getButtonByText(editForm!, "Save assistant profile");

    await act(async () => {
      setControlValue(getLabeledControl(editForm!, "Display name"), "Primary assistant profile updated");
      setControlValue(getLabeledControl(editForm!, "Status"), "paused");
      setControlValue(getLabeledControl(editForm!, "Tone"), "formal");
      setControlValue(getLabeledControl(editForm!, "Summary"), "Updated summary after audit.");
      setControlValue(getLabeledControl(editForm!, "Assistant mode enabled"), "yes");
      setControlValue(getLabeledControl(editForm!, "Default profile"), "no");
      setControlValue(getLabeledControl(editForm!, "Preferred contact ID"), "contact_alpha");
      setControlValue(getLabeledControl(editForm!, "Timezone"), "Europe/Berlin");
      setControlValue(getLabeledControl(editForm!, "Locale"), "de-DE");
      setControlValue(getLabeledControl(editForm!, "Mail source ID"), "source_mail_primary");
      setControlValue(getLabeledControl(editForm!, "Calendar source ID"), "source_calendar_primary");
      setControlValue(getLabeledControl(editForm!, "Action policies JSON"), "{\"direct_action_policy\":\"approval_required\"}");
      editButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(updateAssistantProfileMock).toHaveBeenCalledWith("instance_alpha", "assistant_profile_primary", expect.objectContaining({
      display_name: "Primary assistant profile updated",
      summary: "Updated summary after audit.",
      status: "paused",
      assistant_mode_enabled: true,
      is_default: false,
      tone: "formal",
      timezone: "Europe/Berlin",
      locale: "de-DE",
      preferred_contact_id: "contact_alpha",
      mail_source_id: "source_mail_primary",
      calendar_source_id: "source_calendar_primary",
      action_policies: { direct_action_policy: "approval_required" },
    }));

    const evaluateButton = getButtonByText(evaluateForm!, "Evaluate assistant action");

    await act(async () => {
      setControlValue(getLabeledControl(evaluateForm!, "Action mode"), "direct");
      setControlValue(getLabeledControl(evaluateForm!, "Action kind"), "send_notification");
      setControlValue(getLabeledControl(evaluateForm!, "Priority"), "critical");
      setControlValue(getLabeledControl(evaluateForm!, "Channel ID"), "channel_primary");
      setControlValue(getLabeledControl(evaluateForm!, "Target contact ID"), "contact_alpha");
      setControlValue(getLabeledControl(evaluateForm!, "Occurred at"), "2026-04-23T02:00:00Z");
      setControlValue(getLabeledControl(evaluateForm!, "Requires external delivery"), "yes");
      setControlValue(getLabeledControl(evaluateForm!, "Approval reference"), "approval-123");
      setControlValue(getLabeledControl(evaluateForm!, "Metadata JSON"), "{\"reason\":\"night send\"}");
      evaluateButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(evaluateAssistantActionMock).toHaveBeenCalledWith("instance_alpha", "assistant_profile_primary", expect.objectContaining({
      action_mode: "direct",
      action_kind: "send_notification",
      priority: "critical",
      channel_id: "channel_primary",
      target_contact_id: "contact_alpha",
      occurred_at: "2026-04-23T02:00:00Z",
      requires_external_delivery: true,
      approval_reference: "approval-123",
      metadata: { reason: "night send" },
    }));
    expect(container.textContent).toContain("requires_preview");
  });
});
