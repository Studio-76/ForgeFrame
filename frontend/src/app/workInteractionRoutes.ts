import type { ArtifactAttachmentTargetKind } from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "./navigation";

function buildScopedPath(
  pathname: string,
  params: Record<string, string | ArtifactAttachmentTargetKind | null | undefined>,
): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const normalized = typeof value === "string" ? value.trim() : value;
    if (!normalized) {
      return;
    }
    search.set(key, normalized);
  });

  const encoded = search.toString();
  return encoded ? `${pathname}?${encoded}` : pathname;
}

export function buildWorkspacePath(options: { instanceId?: string | null; workspaceId?: string | null } = {}): string {
  return buildScopedPath(CONTROL_PLANE_ROUTES.workspaces, {
    instanceId: options.instanceId,
    workspaceId: options.workspaceId,
  });
}

export function buildConversationPath(options: {
  instanceId?: string | null;
  conversationId?: string | null;
  status?: string | null;
  triageStatus?: string | null;
} = {}): string {
  return buildScopedPath(CONTROL_PLANE_ROUTES.conversations, {
    instanceId: options.instanceId,
    conversationId: options.conversationId,
    status: options.status,
    triageStatus: options.triageStatus,
  });
}

export function buildInboxPath(options: {
  instanceId?: string | null;
  inboxId?: string | null;
  status?: string | null;
  triageStatus?: string | null;
  priority?: string | null;
} = {}): string {
  return buildScopedPath(CONTROL_PLANE_ROUTES.inbox, {
    instanceId: options.instanceId,
    inboxId: options.inboxId,
    status: options.status,
    triageStatus: options.triageStatus,
    priority: options.priority,
  });
}

export function buildTaskPath(options: {
  instanceId?: string | null;
  taskId?: string | null;
  status?: string | null;
} = {}): string {
  return buildScopedPath(CONTROL_PLANE_ROUTES.tasks, {
    instanceId: options.instanceId,
    taskId: options.taskId,
    status: options.status,
  });
}

export function buildReminderPath(options: {
  instanceId?: string | null;
  reminderId?: string | null;
  status?: string | null;
} = {}): string {
  return buildScopedPath(CONTROL_PLANE_ROUTES.reminders, {
    instanceId: options.instanceId,
    reminderId: options.reminderId,
    status: options.status,
  });
}

export function buildAutomationPath(options: {
  instanceId?: string | null;
  automationId?: string | null;
  status?: string | null;
} = {}): string {
  return buildScopedPath(CONTROL_PLANE_ROUTES.automations, {
    instanceId: options.instanceId,
    automationId: options.automationId,
    status: options.status,
  });
}

export function buildNotificationPath(options: {
  instanceId?: string | null;
  notificationId?: string | null;
  deliveryStatus?: string | null;
  priority?: string | null;
} = {}): string {
  return buildScopedPath(CONTROL_PLANE_ROUTES.notifications, {
    instanceId: options.instanceId,
    notificationId: options.notificationId,
    deliveryStatus: options.deliveryStatus,
    priority: options.priority,
  });
}

export function buildChannelPath(options: {
  instanceId?: string | null;
  channelId?: string | null;
  status?: string | null;
} = {}): string {
  return buildScopedPath(CONTROL_PLANE_ROUTES.channels, {
    instanceId: options.instanceId,
    channelId: options.channelId,
    status: options.status,
  });
}

export function buildContactPath(options: {
  instanceId?: string | null;
  contactId?: string | null;
  status?: string | null;
} = {}): string {
  return buildScopedPath(CONTROL_PLANE_ROUTES.contacts, {
    instanceId: options.instanceId,
    contactId: options.contactId,
    status: options.status,
  });
}

export function buildKnowledgeSourcePath(options: {
  instanceId?: string | null;
  sourceId?: string | null;
  sourceKind?: string | null;
  status?: string | null;
} = {}): string {
  return buildScopedPath(CONTROL_PLANE_ROUTES.knowledgeSources, {
    instanceId: options.instanceId,
    sourceId: options.sourceId,
    sourceKind: options.sourceKind,
    status: options.status,
  });
}

export function buildMemoryPath(options: {
  instanceId?: string | null;
  memoryId?: string | null;
  status?: string | null;
  visibilityScope?: string | null;
} = {}): string {
  return buildScopedPath(CONTROL_PLANE_ROUTES.memory, {
    instanceId: options.instanceId,
    memoryId: options.memoryId,
    status: options.status,
    visibilityScope: options.visibilityScope,
  });
}

export function buildAssistantProfilePath(options: {
  instanceId?: string | null;
  assistantProfileId?: string | null;
  status?: string | null;
} = {}): string {
  return buildScopedPath(CONTROL_PLANE_ROUTES.assistantProfiles, {
    instanceId: options.instanceId,
    assistantProfileId: options.assistantProfileId,
    status: options.status,
  });
}

export function buildArtifactsPath(options: {
  instanceId?: string | null;
  artifactId?: string | null;
  workspaceId?: string | null;
  targetKind?: ArtifactAttachmentTargetKind | null;
  targetId?: string | null;
} = {}): string {
  return buildScopedPath(CONTROL_PLANE_ROUTES.artifacts, {
    instanceId: options.instanceId,
    artifactId: options.artifactId,
    workspaceId: options.workspaceId,
    targetKind: options.targetKind,
    targetId: options.targetId,
  });
}
