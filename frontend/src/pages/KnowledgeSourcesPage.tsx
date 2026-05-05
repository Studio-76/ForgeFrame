import { RegistryManagementPage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import type { SummaryStripItem } from "../components/ui/SummaryStrip";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import {
  CreateKnowledgeSourcePanel,
  DEFAULT_CREATE_FORM,
  EmptyState,
  KnowledgeSourceDetailPanel,
  KnowledgeSourceFilters,
  KnowledgeSourcesSummaryHero,
  KnowledgeSourceTable,
  useKnowledgeSources,
  type KnowledgeSourceSummaryCounts,
} from "../features/knowledge-sources";

/**
 * Knowledge Sources page — redesigned lifecycle management surface.
 *
 * Shows a top-level summary hero with KPIs, then either an empty state
 * or the source inventory table. The create form is hidden until the
 * operator clicks "Create knowledge source". Rendered inside
 * RegistryManagementPage template.
 */
export function KnowledgeSourcesPage() {
  const sources = useKnowledgeSources();

  const { canMutate, instanceId, sessionReady, canRead } = sources;
  const summaryCounts: KnowledgeSourceSummaryCounts = sources.summaryCounts;
  const hasSources = summaryCounts.total > 0;
  const showCreate = sources.showCreateForm;

  // ── Scope config ───────────────────────────────────────────
  const scope = instanceId
    ? {
        label: instanceId,
      }
    : undefined;

  // ── Summary items ──────────────────────────────────────────
  const summaryItems: SummaryStripItem[] = [
    { key: "total", label: "Total", value: summaryCounts.total, tone: summaryCounts.total > 0 ? "success" as const : undefined },
    { key: "active", label: "Active", value: summaryCounts.active, tone: "success" as const },
    { key: "paused", label: "Paused", value: summaryCounts.paused },
    { key: "error", label: "Error", value: summaryCounts.error, tone: summaryCounts.error > 0 ? "warning" as const : undefined },
    { key: "indexed-objects", label: "Indexed objects", value: summaryCounts.indexedObjects },
    { key: "attention", label: "Attention", value: summaryCounts.attention, tone: summaryCounts.attention > 0 ? "warning" as const : undefined },
  ];

  // ── Attention items ────────────────────────────────────────
  const attentionItems: AttentionPayload[] = [];
  if (sources.error) {
    attentionItems.push({ key: "sources-error", level: "primary_blocker", title: sources.error });
  }
  if (sources.message) {
    attentionItems.push({ key: "sources-message", level: "informational", title: sources.message });
  }
  if (!canMutate) {
    attentionItems.push({ key: "read-only", level: "informational", title: "Read only — mutation not available" });
  }

  // ── Access gate (early return) ─────────────────────────────
  if (!sessionReady) {
    return (
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Knowledge Sources"
        description="Restoring knowledge-source scope before exposing sync state, scope, and recall posture."
      />
    );
  }

  if (!canRead) {
    return (
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Knowledge Sources"
        description="This route is reserved for operators and admins who can inspect real connector and context-source truth."
        isEmpty
        emptyTitle="Knowledge-source access unavailable"
        emptyDescription="This session does not hold the required permissions to inspect knowledge-source records."
      />
    );
  }

  return (
    <RegistryManagementPage
      eyebrow="Work Interaction"
      title="Knowledge Sources"
      description="Connector-backed recall sources with scope, sync posture, visibility, indexed object counts, and downstream links into contacts, conversations, skills, and durable memory."
      scope={scope}
      attentionItems={attentionItems}
      summaryItems={summaryItems}
      actions={canMutate && instanceId
        ? [
            {
              label: "Create knowledge source",
              kind: "primary",
              intent: "configure",
              onClick: () => sources.setShowCreateForm(true),
              disabled: !canMutate || !instanceId,
            },
          ]
        : undefined}
      selectedItemContent={
        <KnowledgeSourceDetailPanel
          detail={sources.detail}
          detailState={sources.detailState}
          instanceId={instanceId}
          canMutate={canMutate}
          editForm={sources.editForm}
          setEditForm={sources.setEditForm}
          showEditForm={sources.showEditForm}
          setShowEditForm={sources.setShowEditForm}
          savingUpdate={sources.savingUpdate}
          handleUpdate={sources.handleUpdate}
        />
      }
      hasSelection={!!sources.sourceId}
      emptyDetailHint="Select a knowledge source from the table to inspect its configuration."
      diagnostics={
        <AdvancedDiagnostics title="Knowledge-source diagnostics">
          <span className="text-meta text-muted italic">No diagnostic data available.</span>
        </AdvancedDiagnostics>
      }
    >
      {/* ── Summary hero ── */}
      <KnowledgeSourcesSummaryHero
        totalSources={summaryCounts.total}
        activeCount={summaryCounts.active}
        pausedCount={summaryCounts.paused}
        errorCount={summaryCounts.error}
        indexedObjects={summaryCounts.indexedObjects}
        attentionCount={summaryCounts.attention}
        canMutate={canMutate}
        hasInstance={Boolean(instanceId)}
        loading={sources.listState === "loading"}
        onCreateSource={() => sources.setShowCreateForm(true)}
      />

      {/* ── Error / message display ── */}
      {/* (handled via attentionItems above) */}

      {/* ── Create form mode ── */}
      {showCreate ? (
        <CreateKnowledgeSourcePanel
          createForm={sources.createForm}
          setCreateForm={sources.setCreateForm}
          canMutate={canMutate}
          savingCreate={sources.savingCreate}
          handleCreate={sources.handleCreate}
          onCancel={() => {
            sources.setCreateForm(DEFAULT_CREATE_FORM);
            sources.setShowCreateForm(false);
          }}
        />
      ) : !hasSources && sources.listState !== "loading" ? (
        /* ── Empty state ── */
        <EmptyState
          canMutate={canMutate}
          hasInstance={Boolean(instanceId)}
          instanceId={instanceId}
          onCreateSource={() => sources.setShowCreateForm(true)}
        />
      ) : (
        /* ── Source browse mode ── */
        <>
          <KnowledgeSourceFilters
            sourceKindFilter={sources.sourceKindFilter}
            statusFilter={sources.statusFilter}
            updateRoute={sources.updateRoute}
          />
          <div className="fg-grid ff-sources-browse-layout">
            <KnowledgeSourceTable
              sources={sources.sources}
              selectedSourceId={sources.sourceId}
              listState={sources.listState}
              updateRoute={sources.updateRoute}
            />
          </div>
        </>
      )}
    </RegistryManagementPage>
  );
}
