import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { buildInboxPath } from "../app/workInteractionRoutes";
import { PageIntro } from "../components/PageIntro";
import { AppendMessageForm } from "../features/conversations/AppendMessageForm";
import { ConversationContextPanel } from "../features/conversations/ConversationContextPanel";
import { ConversationFilterBar } from "../features/conversations/ConversationFilterBar";
import { ConversationList } from "../features/conversations/ConversationList";
import { ConversationTimeline } from "../features/conversations/ConversationTimeline";
import { CreateConversationFormComponent } from "../features/conversations/CreateConversationForm";
import { EditConversationFormComponent } from "../features/conversations/EditConversationForm";
import { useConversations } from "../features/conversations/useConversations";

/**
 * Conversations page — thin wrapper that delegates all state,
 * filtering, and rendering to the `features/conversations/` module.
 */
export function ConversationsPage() {
  const {
    session,
    sessionReady,
    canRead,
    canMutate,
    instanceId,
    statusFilter,
    triageFilter,
    agentFilter,
    instances,
    agents,
    detail,
    instancesState,
    agentsState,
    tasksState,
    listState,
    detailState,
    createForm,
    editForm,
    appendForm,
    savingCreate,
    savingUpdate,
    savingAppend,
    error,
    message,
    threadLensId,
    messageDirectionLens,
    messageAgentLensId,
    linkLens,
    selectableAgents,
    participantSelectableAgents,
    mentionSelectableAgents,
    roundtableSelectableAgents,
    handoffSelectableAgents,
    visibleConversations,
    visibleTasks,
    conversations,
    selectedConversationId,
    filteredTimelineItems,
    threadTitleById,
    sessionById,
    composerStructuredSelections,
    updateRoute,
    resolveAgentLabel,
    handleCreate,
    handleUpdate,
    handleAppend,
    setCreateForm,
    setEditForm,
    setAppendForm,
    setThreadLensId,
    setMessageDirectionLens,
    setMessageAgentLensId,
    setLinkLens,
  } = useConversations();

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Conversations"
          description="ForgeFrame is restoring the conversation scope before exposing persisted thread and session history."
          question="Which conversation surface should anchor the next piece of inbound work?"
          links={[
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while session scope resolves." },
            { label: "Inbox", to: CONTROL_PLANE_ROUTES.inbox, description: "Open the triage queue after session scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Conversation truth stays instance-scoped and history-backed. ForgeFrame waits for session state before opening the surface."
        />
      </section>
    );
  }

  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Conversations"
          description="This route is reserved for operators and admins who can inspect real conversation and continuation state."
          question="Which adjacent surface should stay open when conversation review is outside the current permission envelope?"
          links={[
            { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect runtime truth without opening conversation history." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Review approval state when the conversation surface is unavailable." },
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard and branch into the correct route." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="Viewers do not get a cosmetic conversation shell. This route stays closed unless the session can inspect real work-interaction truth."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Conversations"
        description="Persistent conversations with thread/session history, continuation context, and links back to runtime, approvals, workspace, and inbox triage."
        question="Is the current conversation carrying real history and triage truth, or is work still dissolving into loose runs, approvals, and notes?"
        links={[
          { label: "Conversations", to: CONTROL_PLANE_ROUTES.conversations, description: "Stay on the conversation inventory and detail surface." },
          { label: "Inbox", to: buildInboxPath({ instanceId }), description: "Open the triage queue linked to conversation work." },
          { label: "Workspaces", to: CONTROL_PLANE_ROUTES.workspaces, description: "Open workspace truth linked from the selected conversation." },
          { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect runtime truth linked from the selected conversation." },
        ]}
        badges={[
          { label: `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`, tone: conversations.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Conversations are first-class objects. Threads, sessions, messages, triage, and inbox linkage must reconcile here."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <ConversationFilterBar
        instances={instances}
        instanceId={instanceId}
        statusFilter={statusFilter}
        triageFilter={triageFilter}
        agentFilter={agentFilter}
        linkLens={linkLens}
        agents={agents}
        instancesState={instancesState}
        agentsState={agentsState}
        tasksState={tasksState}
        updateRoute={updateRoute}
        setLinkLens={setLinkLens}
      />

      <div className="fg-card-grid">
        <ConversationList
          visibleConversations={visibleConversations}
          listState={listState}
          selectedConversationId={selectedConversationId}
          detail={detail}
          threadLensId={threadLensId}
          conversations={conversations}
          updateRoute={updateRoute}
          setThreadLensId={setThreadLensId}
          setEditForm={setEditForm}
        />

        <ConversationTimeline
          detail={detail}
          detailState={detailState}
          filteredTimelineItems={filteredTimelineItems}
          threadTitleById={threadTitleById}
          sessionById={sessionById}
          resolveAgentLabel={resolveAgentLabel}
          instanceId={instanceId}
        />

        {detail ? (
          <AppendMessageForm
            detail={detail}
            appendForm={appendForm}
            canMutate={canMutate}
            savingAppend={savingAppend}
            mentionSelectableAgents={mentionSelectableAgents}
            roundtableSelectableAgents={roundtableSelectableAgents}
            handoffSelectableAgents={handoffSelectableAgents}
            composerStructuredSelections={composerStructuredSelections}
            instanceId={instanceId}
            handleAppend={handleAppend}
            setAppendForm={setAppendForm}
          />
        ) : null}

        <ConversationContextPanel
          detail={detail}
          instanceId={instanceId}
          threadLensId={threadLensId}
          messageDirectionLens={messageDirectionLens}
          messageAgentLensId={messageAgentLensId}
          selectableAgents={selectableAgents}
          visibleTasks={visibleTasks}
          tasksState={tasksState}
          resolveAgentLabel={resolveAgentLabel}
          setThreadLensId={setThreadLensId}
          setMessageDirectionLens={setMessageDirectionLens}
          setMessageAgentLensId={setMessageAgentLensId}
        />
      </div>

      <div className="fg-grid">
        <CreateConversationFormComponent
          createForm={createForm}
          canMutate={canMutate}
          savingCreate={savingCreate}
          instanceId={instanceId}
          participantSelectableAgents={participantSelectableAgents}
          mentionSelectableAgents={mentionSelectableAgents}
          handleCreate={handleCreate}
          setCreateForm={setCreateForm}
        />

        <EditConversationFormComponent
          detail={detail}
          editForm={editForm}
          canMutate={canMutate}
          savingUpdate={savingUpdate}
          handleUpdate={handleUpdate}
          setEditForm={setEditForm}
        />
      </div>
    </section>
  );
}
