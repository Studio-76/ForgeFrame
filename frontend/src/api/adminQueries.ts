import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchAccounts,
  fetchAdminSession,
  fetchAdminSessions,
  fetchAdminUserMemberships,
  fetchAdminUsers,
  fetchAgentDetail,
  fetchAgents,
  fetchApprovalDetail,
  fetchApprovals,
  fetchArtifactDetail,
  fetchArtifacts,
  fetchAssistantProfileDetail,
  fetchAssistantProfiles,
  fetchAuditHistory,
  fetchAuditHistoryDetail,
  fetchAutomationDetail,
  fetchAutomations,
  fetchBootstrapReadiness,
  fetchChannelDetail,
  fetchChannels,
  fetchClientDrilldown,
  fetchClientOperationalView,
  fetchCompatibilityMatrix,
  fetchContactDetail,
  fetchContacts,
  fetchConversationDetail,
  fetchConversations,
  fetchDashboard,
  fetchElevatedAccessRequests,
  fetchExecutionDispatch,
  // fetchExecutionQueueDetail removed — does not exist in admin.ts
  fetchExecutionQueues,
  fetchExecutionRunDetail,
  fetchExecutionRuns,
  fetchHarnessExport,
  fetchHarnessProfiles,
  fetchHarnessRuns,
  fetchHarnessSnapshot,
  fetchHarnessTemplates,
  fetchInboxItemDetail,
  fetchInboxItems,
  fetchIngressTlsStatus,
  fetchInstances,
  fetchKnowledgeSourceDetail,
  fetchKnowledgeSources,
  fetchLearningEventDetail,
  fetchLearningEvents,
  fetchLogs,
  fetchMemoryDetail,
  fetchMemoryEntries,
  fetchModelRegister,
  fetchMutableSettings,
  fetchNotificationDetail,
  fetchNotifications,
  fetchOauthAccountOperations,
  fetchOauthAccountTargets,
  fetchOauthOnboarding,
  fetchPluginDetail,
  fetchPlugins,
  fetchProductAxisTargets,
  fetchProviderControlPlane,
  fetchProviderDrilldown,
  fetchProviderSecretPosture,
  fetchProviderTargets,
  fetchRecoveryOverview,
  fetchReminderDetail,
  fetchReminders,
  fetchRoutingControlPlane,
  fetchRuntimeKeyRequestPathPolicy,
  fetchRuntimeKeys,
  fetchSecurityBootstrap,
  fetchSkillDetail,
  fetchSkills,
  fetchTaskDetail,
  fetchTasks,
  fetchUsageSummary,
  fetchWorkspaceDetail,
  fetchWorkspaces,
  getAdminToken,
  loginAdmin,
  logoutAdmin,
  rotateOwnPassword,
  setAdminToken,
  clearAdminToken,
  type AdminSessionUser,
  type InstanceRecord,
  type DashboardResponse,
  type UsageSummaryFilters,
} from "./domain";

/* ───── Query key factories ───── */

export const adminKeys = {
  session: ["adminSession"] as const,
  instances: ["instances"] as const,
  dashboard: (instanceId?: string | null) => ["dashboard", instanceId] as const,
  agents: (instanceId?: string | null) => ["agents", instanceId] as const,
  agentDetail: (agentId: string, instanceId?: string | null) =>
    ["agentDetail", agentId, instanceId] as const,
  skills: (instanceId?: string | null) => ["skills", instanceId] as const,
  skillDetail: (skillId: string, instanceId?: string | null) =>
    ["skillDetail", skillId, instanceId] as const,
  learningEvents: (instanceId?: string | null) =>
    ["learningEvents", instanceId] as const,
  learningEventDetail: (eventId: string, instanceId?: string | null) =>
    ["learningEventDetail", eventId, instanceId] as const,
  plugins: (instanceId?: string | null) => ["plugins", instanceId] as const,
  pluginDetail: (pluginId: string, instanceId?: string | null) =>
    ["pluginDetail", pluginId, instanceId] as const,
  accounts: (instanceId?: string | null) => ["accounts", instanceId] as const,
  runtimeKeys: (instanceId?: string | null) =>
    ["runtimeKeys", instanceId] as const,
  mutableSettings: ["mutableSettings"] as const,
  logs: (
    instanceId?: string | null,
    tenantId?: string | null,
    companyId?: string | null,
  ) => ["logs", instanceId, tenantId, companyId] as const,
  auditHistory: (query?: Record<string, unknown>) =>
    ["auditHistory", query] as const,
  auditHistoryDetail: (
    eventId: string,
    instanceId?: string | null,
    tenantId?: string | null,
    companyId?: string | null,
  ) => ["auditHistoryDetail", eventId, instanceId, tenantId, companyId] as const,
  approvals: (options?: Record<string, unknown>) =>
    ["approvals", options] as const,
  approvalDetail: (approvalId: string, instanceId?: string | null) =>
    ["approvalDetail", approvalId, instanceId] as const,
  executionRuns: (options?: Record<string, unknown>) =>
    ["executionRuns", options] as const,
  executionQueues: (options?: Record<string, unknown>) =>
    ["executionQueues", options] as const,
  executionDispatch: (options?: { instanceId?: string | null; companyId?: string | null }) =>
    ["executionDispatch", options] as const,
  executionRunDetail: (
    runId: string,
    options?: { instanceId?: string | null; companyId?: string | null },
  ) => ["executionRunDetail", runId, options] as const,
  workspaces: (instanceId?: string | null) =>
    ["workspaces", instanceId] as const,
  workspaceDetail: (workspaceId: string, instanceId?: string | null) =>
    ["workspaceDetail", workspaceId, instanceId] as const,
  artifacts: (options?: Record<string, unknown>) =>
    ["artifacts", options] as const,
  artifactDetail: (artifactId: string, instanceId?: string | null) =>
    ["artifactDetail", artifactId, instanceId] as const,
  conversations: (instanceId?: string | null) =>
    ["conversations", instanceId] as const,
  conversationDetail: (
    conversationId: string,
    instanceId?: string | null,
  ) => ["conversationDetail", conversationId, instanceId] as const,
  inboxItems: (instanceId?: string | null) =>
    ["inboxItems", instanceId] as const,
  inboxItemDetail: (inboxId: string, instanceId?: string | null) =>
    ["inboxItemDetail", inboxId, instanceId] as const,
  tasks: (instanceId?: string | null) => ["tasks", instanceId] as const,
  taskDetail: (taskId: string, instanceId?: string | null) =>
    ["taskDetail", taskId, instanceId] as const,
  reminders: (instanceId?: string | null) =>
    ["reminders", instanceId] as const,
  reminderDetail: (reminderId: string, instanceId?: string | null) =>
    ["reminderDetail", reminderId, instanceId] as const,
  channels: (instanceId?: string | null) =>
    ["channels", instanceId] as const,
  channelDetail: (channelId: string, instanceId?: string | null) =>
    ["channelDetail", channelId, instanceId] as const,
  notifications: (instanceId?: string | null) =>
    ["notifications", instanceId] as const,
  notificationDetail: (notificationId: string, instanceId?: string | null) =>
    ["notificationDetail", notificationId, instanceId] as const,
  automations: (instanceId?: string | null) =>
    ["automations", instanceId] as const,
  automationDetail: (automationId: string, instanceId?: string | null) =>
    ["automationDetail", automationId, instanceId] as const,
  contacts: (instanceId?: string | null) =>
    ["contacts", instanceId] as const,
  contactDetail: (contactId: string, instanceId?: string | null) =>
    ["contactDetail", contactId, instanceId] as const,
  knowledgeSources: (instanceId?: string | null) =>
    ["knowledgeSources", instanceId] as const,
  knowledgeSourceDetail: (sourceId: string, instanceId?: string | null) =>
    ["knowledgeSourceDetail", sourceId, instanceId] as const,
  memoryEntries: (instanceId?: string | null) =>
    ["memoryEntries", instanceId] as const,
  memoryDetail: (memoryId: string, instanceId?: string | null) =>
    ["memoryDetail", memoryId, instanceId] as const,
  assistantProfiles: (instanceId?: string | null) =>
    ["assistantProfiles", instanceId] as const,
  assistantProfileDetail: (
    assistantProfileId: string,
    instanceId?: string | null,
  ) => ["assistantProfileId", assistantProfileId, instanceId] as const,
  securityBootstrap: ["securityBootstrap"] as const,
  elevatedAccessRequests: (gateStatus?: string) =>
    ["elevatedAccessRequests", gateStatus] as const,
  adminUsers: ["adminUsers"] as const,
  adminUserMemberships: (userId: string) =>
    ["adminUserMemberships", userId] as const,
  adminSessions: ["adminSessions"] as const,
  providerSecretPosture: ["providerSecretPosture"] as const,
  providerControlPlane: (instanceId?: string | null) =>
    ["providerControlPlane", instanceId] as const,
  modelRegister: (instanceId?: string | null) =>
    ["modelRegister", instanceId] as const,
  providerTargets: (instanceId?: string | null) =>
    ["providerTargets", instanceId] as const,
  routingControlPlane: (instanceId?: string | null) =>
    ["routingControlPlane", instanceId] as const,
  compatibilityMatrix: (instanceId?: string | null) =>
    ["compatibilityMatrix", instanceId] as const,
  usageSummary: (
    window?: string,
    filters?: Record<string, string | null | undefined>,
    instanceId?: string | null,
  ) => ["usageSummary", window, filters, instanceId] as const,
  harnessTemplates: ["harnessTemplates"] as const,
  harnessProfiles: (instanceId?: string | null) =>
    ["harnessProfiles", instanceId] as const,
  harnessExport: (redactSecrets?: boolean, instanceId?: string | null) =>
    ["harnessExport", redactSecrets, instanceId] as const,
  harnessRuns: (
    providerKey?: string,
    mode?: string,
    status?: string,
    clientId?: string,
    limit?: number,
    instanceId?: string | null,
  ) => ["harnessRuns", providerKey, mode, status, clientId, limit, instanceId] as const,
  clientOperationalView: (
    window?: string,
    instanceId?: string | null,
  ) => ["clientOperationalView", window, instanceId] as const,
  providerDrilldown: (
    provider: string,
    window?: string,
    instanceId?: string | null,
  ) => ["providerDrilldown", provider, window, instanceId] as const,
  clientDrilldown: (
    clientId: string,
    window?: string,
    instanceId?: string | null,
  ) => ["clientDrilldown", clientId, window, instanceId] as const,
  productAxisTargets: (instanceId?: string | null) =>
    ["productAxisTargets", instanceId] as const,
  oauthAccountTargets: (instanceId?: string | null) =>
    ["oauthAccountTargets", instanceId] as const,
  oauthOnboarding: (instanceId?: string | null) =>
    ["oauthOnboarding", instanceId] as const,
  oauthAccountOperations: (instanceId?: string | null) =>
    ["oauthAccountOperations", instanceId] as const,
  bootstrapReadiness: ["bootstrapReadiness"] as const,
  ingressTlsStatus: ["ingressTlsStatus"] as const,
  recoveryOverview: ["recoveryOverview"] as const,
};

/* ───── Session ───── */

/**
 * Fetch the current admin session.
 * Disabled automatically when no token is present.
 */
export function useAdminSessionQuery() {
  return useQuery({
    queryKey: adminKeys.session,
    queryFn: fetchAdminSession,
    select: (data) => data.user,
    enabled: Boolean(getAdminToken()),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/** Log the current session out (mutation). */
export function useAdminLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutAdmin,
    onSuccess: () => {
      clearAdminToken();
      void queryClient.invalidateQueries({ queryKey: adminKeys.session });
    },
  });
}

/** Login mutation — stores the token on success. */
export function useAdminLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      loginAdmin(credentials),
    onSuccess: (data) => {
      setAdminToken(data.access_token);
      void queryClient.invalidateQueries({ queryKey: adminKeys.session });
    },
  });
}

/** Rotate own password mutation. */
export function useRotateOwnPasswordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      current_password: string;
      new_password: string;
    }) => rotateOwnPassword(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.session });
    },
  });
}

/* ───── Instances ───── */

/**
 * Fetch the full instance inventory.
 */
export function useInstancesQuery() {
  return useQuery({
    queryKey: adminKeys.instances,
    queryFn: fetchInstances,
    select: (data) => data.instances,
    staleTime: 60 * 1000,
  });
}

/* ───── Dashboard ───── */

/**
 * Fetch the command‑center dashboard for the given scope.
 */
export function useDashboardQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.dashboard(instanceId),
    queryFn: () => fetchDashboard(instanceId),
    staleTime: 15 * 1000,
  });
}

/* ───── Provider control plane ───── */

export function useProviderControlPlaneQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.providerControlPlane(instanceId),
    queryFn: () => fetchProviderControlPlane(instanceId),
  });
}

export function useModelRegisterQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.modelRegister(instanceId),
    queryFn: () => fetchModelRegister(instanceId),
  });
}

export function useProviderTargetsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.providerTargets(instanceId),
    queryFn: () => fetchProviderTargets(instanceId),
  });
}

export function useRoutingControlPlaneQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.routingControlPlane(instanceId),
    queryFn: () => fetchRoutingControlPlane(instanceId),
  });
}

export function useCompatibilityMatrixQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.compatibilityMatrix(instanceId),
    queryFn: () => fetchCompatibilityMatrix(instanceId),
  });
}

/* ───── Agents ───── */

export function useAgentsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.agents(instanceId),
    queryFn: () => fetchAgents(instanceId),
  });
}

export function useAgentDetailQuery(
  agentId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.agentDetail(agentId, instanceId),
    queryFn: () => fetchAgentDetail(agentId, instanceId),
    enabled: Boolean(agentId),
  });
}

/* ───── Skills ───── */

export function useSkillsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.skills(instanceId),
    queryFn: () => fetchSkills(instanceId),
  });
}

export function useSkillDetailQuery(
  skillId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.skillDetail(skillId, instanceId),
    queryFn: () => fetchSkillDetail(skillId, instanceId),
    enabled: Boolean(skillId),
  });
}

/* ───── Learning events ───── */

export function useLearningEventsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.learningEvents(instanceId),
    queryFn: () => fetchLearningEvents(instanceId),
  });
}

export function useLearningEventDetailQuery(
  eventId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.learningEventDetail(eventId, instanceId),
    queryFn: () => fetchLearningEventDetail(eventId, instanceId),
    enabled: Boolean(eventId),
  });
}

/* ───── Plugins ───── */

export function usePluginsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.plugins(instanceId),
    queryFn: () => fetchPlugins(instanceId),
  });
}

export function usePluginDetailQuery(
  pluginId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.pluginDetail(pluginId, instanceId),
    queryFn: () => fetchPluginDetail(pluginId, instanceId),
    enabled: Boolean(pluginId),
  });
}

/* ───── Accounts / Runtime keys ───── */

export function useAccountsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.accounts(instanceId),
    queryFn: () => fetchAccounts(instanceId),
  });
}

export function useRuntimeKeysQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.runtimeKeys(instanceId),
    queryFn: () => fetchRuntimeKeys(instanceId),
  });
}

export function useRuntimeKeyRequestPathPolicyQuery(
  instanceId: string | null | undefined,
  keyId: string,
) {
  return useQuery({
    queryKey: [...adminKeys.runtimeKeys(instanceId), "requestPathPolicy", keyId],
    queryFn: () => fetchRuntimeKeyRequestPathPolicy(instanceId, keyId),
    enabled: Boolean(keyId),
  });
}

/* ───── Settings ───── */

export function useMutableSettingsQuery() {
  return useQuery({
    queryKey: adminKeys.mutableSettings,
    queryFn: fetchMutableSettings,
  });
}

/* ───── Logs / Diagnostics ───── */

export function useLogsQuery(
  instanceId?: string | null,
  tenantId?: string | null,
  companyId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.logs(instanceId, tenantId, companyId),
    queryFn: () => fetchLogs(instanceId, tenantId, companyId),
  });
}

/* ───── Audit history ───── */

export function useAuditHistoryQuery(query?: Record<string, unknown>) {
  return useQuery({
    queryKey: adminKeys.auditHistory(query),
    queryFn: () => fetchAuditHistory(query as Parameters<typeof fetchAuditHistory>[0]),
  });
}

export function useAuditHistoryDetailQuery(
  eventId: string,
  instanceId?: string | null,
  tenantId?: string | null,
  companyId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.auditHistoryDetail(eventId, instanceId, tenantId, companyId),
    queryFn: () => fetchAuditHistoryDetail(eventId, instanceId, tenantId, companyId),
    enabled: Boolean(eventId),
  });
}

/* ───── Approvals ───── */

export function useApprovalsQuery(options?: Record<string, unknown>) {
  return useQuery({
    queryKey: adminKeys.approvals(options),
    queryFn: () =>
      fetchApprovals(options as Parameters<typeof fetchApprovals>[0]),
  });
}

export function useApprovalDetailQuery(
  approvalId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.approvalDetail(approvalId, instanceId),
    queryFn: () => fetchApprovalDetail(approvalId, instanceId),
    enabled: Boolean(approvalId),
  });
}

/* ───── Execution ───── */

export function useExecutionRunsQuery(options?: Record<string, unknown>) {
  return useQuery({
    queryKey: adminKeys.executionRuns(options),
    queryFn: () =>
      fetchExecutionRuns(options as Parameters<typeof fetchExecutionRuns>[0]),
  });
}

export function useExecutionQueuesQuery(options?: Record<string, unknown>) {
  return useQuery({
    queryKey: adminKeys.executionQueues(options),
    queryFn: () =>
      fetchExecutionQueues(options as Parameters<typeof fetchExecutionQueues>[0]),
  });
}

export function useExecutionDispatchQuery(
  options?: { instanceId?: string | null; companyId?: string | null },
) {
  return useQuery({
    queryKey: adminKeys.executionDispatch(options),
    queryFn: () => fetchExecutionDispatch(options as Parameters<typeof fetchExecutionDispatch>[0]),
  });
}

export function useExecutionRunDetailQuery(
  runId: string,
  options?: { instanceId?: string | null; companyId?: string | null },
) {
  return useQuery({
    queryKey: adminKeys.executionRunDetail(runId, options),
    queryFn: () => fetchExecutionRunDetail(runId, options as Parameters<typeof fetchExecutionRunDetail>[1]),
    enabled: Boolean(runId),
  });
}

/* ───── Workspaces ───── */

export function useWorkspacesQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.workspaces(instanceId),
    queryFn: () => fetchWorkspaces(instanceId),
  });
}

export function useWorkspaceDetailQuery(
  workspaceId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.workspaceDetail(workspaceId, instanceId),
    queryFn: () => fetchWorkspaceDetail(workspaceId, instanceId),
    enabled: Boolean(workspaceId),
  });
}

/* ───── Artifacts ───── */

export function useArtifactsQuery(options?: Record<string, unknown>) {
  return useQuery({
    queryKey: adminKeys.artifacts(options),
    queryFn: () =>
      fetchArtifacts(options as Parameters<typeof fetchArtifacts>[0]),
  });
}

export function useArtifactDetailQuery(
  artifactId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.artifactDetail(artifactId, instanceId),
    queryFn: () => fetchArtifactDetail(artifactId, instanceId),
    enabled: Boolean(artifactId),
  });
}

/* ───── Conversations ───── */

export function useConversationsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.conversations(instanceId),
    queryFn: () => fetchConversations(instanceId),
  });
}

export function useConversationDetailQuery(
  conversationId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.conversationDetail(conversationId, instanceId),
    queryFn: () => fetchConversationDetail(conversationId, instanceId),
    enabled: Boolean(conversationId),
  });
}

/* ───── Inbox ───── */

export function useInboxItemsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.inboxItems(instanceId),
    queryFn: () => fetchInboxItems(instanceId),
  });
}

export function useInboxItemDetailQuery(
  inboxId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.inboxItemDetail(inboxId, instanceId),
    queryFn: () => fetchInboxItemDetail(inboxId, instanceId),
    enabled: Boolean(inboxId),
  });
}

/* ───── Tasks ───── */

export function useTasksQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.tasks(instanceId),
    queryFn: () => fetchTasks(instanceId),
  });
}

export function useTaskDetailQuery(
  taskId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.taskDetail(taskId, instanceId),
    queryFn: () => fetchTaskDetail(taskId, instanceId),
    enabled: Boolean(taskId),
  });
}

/* ───── Reminders ───── */

export function useRemindersQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.reminders(instanceId),
    queryFn: () => fetchReminders(instanceId),
  });
}

export function useReminderDetailQuery(
  reminderId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.reminderDetail(reminderId, instanceId),
    queryFn: () => fetchReminderDetail(reminderId, instanceId),
    enabled: Boolean(reminderId),
  });
}

/* ───── Channels ───── */

export function useChannelsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.channels(instanceId),
    queryFn: () => fetchChannels(instanceId),
  });
}

export function useChannelDetailQuery(
  channelId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.channelDetail(channelId, instanceId),
    queryFn: () => fetchChannelDetail(channelId, instanceId),
    enabled: Boolean(channelId),
  });
}

/* ───── Notifications ───── */

export function useNotificationsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.notifications(instanceId),
    queryFn: () => fetchNotifications(instanceId),
  });
}

export function useNotificationDetailQuery(
  notificationId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.notificationDetail(notificationId, instanceId),
    queryFn: () => fetchNotificationDetail(notificationId, instanceId),
    enabled: Boolean(notificationId),
  });
}

/* ───── Automations ───── */

export function useAutomationsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.automations(instanceId),
    queryFn: () => fetchAutomations(instanceId),
  });
}

export function useAutomationDetailQuery(
  automationId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.automationDetail(automationId, instanceId),
    queryFn: () => fetchAutomationDetail(automationId, instanceId),
    enabled: Boolean(automationId),
  });
}

/* ───── Contacts ───── */

export function useContactsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.contacts(instanceId),
    queryFn: () => fetchContacts(instanceId),
  });
}

export function useContactDetailQuery(
  contactId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.contactDetail(contactId, instanceId),
    queryFn: () => fetchContactDetail(contactId, instanceId),
    enabled: Boolean(contactId),
  });
}

/* ───── Knowledge Sources ───── */

export function useKnowledgeSourcesQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.knowledgeSources(instanceId),
    queryFn: () => fetchKnowledgeSources(instanceId),
  });
}

export function useKnowledgeSourceDetailQuery(
  sourceId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.knowledgeSourceDetail(sourceId, instanceId),
    queryFn: () => fetchKnowledgeSourceDetail(sourceId, instanceId),
    enabled: Boolean(sourceId),
  });
}

/* ───── Memory ───── */

export function useMemoryEntriesQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.memoryEntries(instanceId),
    queryFn: () => fetchMemoryEntries(instanceId),
  });
}

export function useMemoryDetailQuery(
  memoryId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.memoryDetail(memoryId, instanceId),
    queryFn: () => fetchMemoryDetail(memoryId, instanceId),
    enabled: Boolean(memoryId),
  });
}

/* ───── Assistant Profiles ───── */

export function useAssistantProfilesQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.assistantProfiles(instanceId),
    queryFn: () => fetchAssistantProfiles(instanceId),
  });
}

export function useAssistantProfileDetailQuery(
  assistantProfileId: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.assistantProfileDetail(assistantProfileId, instanceId),
    queryFn: () => fetchAssistantProfileDetail(assistantProfileId, instanceId),
    enabled: Boolean(assistantProfileId),
  });
}

/* ───── Security ───── */

export function useSecurityBootstrapQuery() {
  return useQuery({
    queryKey: adminKeys.securityBootstrap,
    queryFn: fetchSecurityBootstrap,
  });
}

export function useElevatedAccessRequestsQuery(
  gateStatus: string = "all",
) {
  return useQuery({
    queryKey: adminKeys.elevatedAccessRequests(gateStatus),
    queryFn: () => fetchElevatedAccessRequests(gateStatus as Parameters<typeof fetchElevatedAccessRequests>[0]),
  });
}

export function useAdminUsersQuery() {
  return useQuery({
    queryKey: adminKeys.adminUsers,
    queryFn: fetchAdminUsers,
  });
}

export function useAdminUserMembershipsQuery(userId: string) {
  return useQuery({
    queryKey: adminKeys.adminUserMemberships(userId),
    queryFn: () => fetchAdminUserMemberships(userId),
    enabled: Boolean(userId),
  });
}

export function useAdminSessionsQuery() {
  return useQuery({
    queryKey: adminKeys.adminSessions,
    queryFn: fetchAdminSessions,
  });
}

export function useProviderSecretPostureQuery() {
  return useQuery({
    queryKey: adminKeys.providerSecretPosture,
    queryFn: fetchProviderSecretPosture,
  });
}

/* ───── Usage ───── */

export function useUsageSummaryQuery(
  window: "1h" | "24h" | "7d" | "all" = "24h",
  instanceId?: string | null,
  filters?: UsageSummaryFilters,
) {
  return useQuery({
    queryKey: adminKeys.usageSummary(window, filters, instanceId),
    queryFn: () => fetchUsageSummary(window, instanceId, filters),
  });
}

/* ───── Harness ───── */

export function useHarnessTemplatesQuery() {
  return useQuery({
    queryKey: adminKeys.harnessTemplates,
    queryFn: fetchHarnessTemplates,
  });
}

export function useHarnessProfilesQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.harnessProfiles(instanceId),
    queryFn: () => fetchHarnessProfiles(instanceId),
  });
}

export function useHarnessSnapshotQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: [...adminKeys.harnessProfiles(instanceId), "snapshot"],
    queryFn: () => fetchHarnessSnapshot(instanceId),
  });
}

export function useHarnessExportQuery(
  redactSecrets = true,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.harnessExport(redactSecrets, instanceId),
    queryFn: () => fetchHarnessExport(redactSecrets, instanceId),
  });
}

export function useHarnessRunsQuery(
  providerKey?: string,
  mode?: string,
  status?: string,
  clientId?: string,
  limit?: number,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.harnessRuns(
      providerKey,
      mode,
      status,
      clientId,
      limit,
      instanceId,
    ),
    queryFn: () =>
      fetchHarnessRuns(
        providerKey,
        mode,
        status,
        clientId,
        limit,
        instanceId,
      ),
  });
}

/* ───── Metrics / Drilldown ───── */

export function useClientOperationalViewQuery(
  window?: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.clientOperationalView(window, instanceId),
    queryFn: () => fetchClientOperationalView(window as Parameters<typeof fetchClientOperationalView>[0], instanceId),
  });
}

export function useProviderDrilldownQuery(
  provider: string,
  window?: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.providerDrilldown(provider, window, instanceId),
    queryFn: () => fetchProviderDrilldown(provider, window as Parameters<typeof fetchProviderDrilldown>[1], instanceId),
    enabled: Boolean(provider),
  });
}

export function useClientDrilldownQuery(
  clientId: string,
  window?: string,
  instanceId?: string | null,
) {
  return useQuery({
    queryKey: adminKeys.clientDrilldown(clientId, window, instanceId),
    queryFn: () => fetchClientDrilldown(clientId, window as Parameters<typeof fetchClientDrilldown>[1], instanceId),
    enabled: Boolean(clientId),
  });
}

/* ───── Product Axis / OAuth ───── */

export function useProductAxisTargetsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.productAxisTargets(instanceId),
    queryFn: () => fetchProductAxisTargets(instanceId),
  });
}

export function useOauthAccountTargetsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.oauthAccountTargets(instanceId),
    queryFn: () => fetchOauthAccountTargets(instanceId),
  });
}

export function useOauthOnboardingQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.oauthOnboarding(instanceId),
    queryFn: () => fetchOauthOnboarding(instanceId),
  });
}

export function useOauthAccountOperationsQuery(instanceId?: string | null) {
  return useQuery({
    queryKey: adminKeys.oauthAccountOperations(instanceId),
    queryFn: () => fetchOauthAccountOperations(instanceId),
  });
}

/* ───── Bootstrap / Ingress / Recovery ───── */

export function useBootstrapReadinessQuery() {
  return useQuery({
    queryKey: adminKeys.bootstrapReadiness,
    queryFn: fetchBootstrapReadiness,
  });
}

export function useIngressTlsStatusQuery() {
  return useQuery({
    queryKey: adminKeys.ingressTlsStatus,
    queryFn: fetchIngressTlsStatus,
  });
}

export function useRecoveryOverviewQuery() {
  return useQuery({
    queryKey: adminKeys.recoveryOverview,
    queryFn: fetchRecoveryOverview,
  });
}
