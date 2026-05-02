import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { PageIntro } from "../components/PageIntro";
import {
  CreateKnowledgeSourcePanel,
  DEFAULT_CREATE_FORM,
  EmptyState,
  KnowledgeSourceDetailPanel,
  KnowledgeSourceFilters,
  KnowledgeSourcesSummaryHero,
  KnowledgeSourceTable,
  useKnowledgeSources,
} from "../features/knowledge-sources";
import { buildInventoryPath } from "../features/knowledge-sources/utils";

/**
 * Knowledge Sources page — redesigned lifecycle management surface.
 *
 * Shows a top-level summary hero with KPIs, then either an empty state or
 * the source inventory table + detail panel. The create form is hidden
 * until the operator clicks "Create knowledge source". The edit form is
 * hidden in the detail panel until the operator clicks "Edit source".
 */
export function KnowledgeSourcesPage() {
  const sources = useKnowledgeSources();

  if (!sources.sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Knowledge Sources"
          description="Restoring knowledge-source scope before exposing sync state, scope, and recall posture."
          question="Which source inventory should open once the active session is restored?"
          links={[
            {
              label: "Contacts",
              to: CONTROL_PLANE_ROUTES.contacts,
              description: "Inspect linked contacts after scope resolves.",
            },
            {
              label: "Command Center",
              to: CONTROL_PLANE_ROUTES.dashboard,
              description: "Return to the dashboard while scope resolves.",
            },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Knowledge sources stay instance-scoped and must surface sync state, visibility, scope, and linkage truth."
        />
      </section>
    );
  }

  if (!sources.canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Knowledge Sources"
          description="This route is reserved for operators and admins who can inspect real connector and context-source truth."
          question="Which adjacent surface should remain open while source access is outside the current permission envelope?"
          links={[
            {
              label: "Contacts",
              to: CONTROL_PLANE_ROUTES.contacts,
              description: "Inspect contact posture without opening source records.",
            },
            {
              label: "Approvals",
              to: CONTROL_PLANE_ROUTES.approvals,
              description: "Review approvals while source truth remains closed.",
            },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic source shell when the session cannot inspect real source state."
        />
      </section>
    );
  }

  const summaryCounts = sources.summaryCounts;
  const hasSources = summaryCounts.total > 0;
  const showCreate = sources.showCreateForm;
  const selectedSourceId = sources.sourceId;

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Knowledge Sources"
        description="Connector-backed recall sources with scope, sync posture, visibility, indexed object counts, and downstream links into contacts, conversations, skills, and durable memory."
        question="Are these sources real product objects with scope and sync truth, or just decorative connector labels without durable context boundaries?"
        links={[
          {
            label: "Knowledge Sources",
            to: buildInventoryPath(CONTROL_PLANE_ROUTES.knowledgeSources, sources.instanceId),
            description: "Stay on the knowledge-source inventory and detail surface.",
          },
          {
            label: "Contacts",
            to: buildInventoryPath(CONTROL_PLANE_ROUTES.contacts, sources.instanceId),
            description: "Inspect contact records linked to the selected source.",
          },
          {
            label: "Memory",
            to: buildInventoryPath(CONTROL_PLANE_ROUTES.memory, sources.instanceId),
            description: "Review durable memory linked to the selected source.",
          },
          {
            label: "Skills",
            to: buildInventoryPath(CONTROL_PLANE_ROUTES.skills, sources.instanceId),
            description: "Inspect skills whose provenance points back to the selected source.",
          },
        ]}
        badges={[
          {
            label: `${sources.sources.length} source${sources.sources.length === 1 ? "" : "s"}`,
            tone: sources.sources.length > 0 ? "success" : "warning",
          },
          {
            label: sources.canMutate ? "Admin mutation enabled" : "Read only",
            tone: sources.canMutate ? "success" : "neutral",
          },
        ]}
        note="Knowledge recall and Durable Memory are different layers: recall can drift on the next sync, while Memory holds governed facts that survive connector changes."
      />

      {/* ── Summary hero ── */}
      <KnowledgeSourcesSummaryHero
        totalSources={summaryCounts.total}
        activeCount={summaryCounts.active}
        pausedCount={summaryCounts.paused}
        errorCount={summaryCounts.error}
        indexedObjects={summaryCounts.indexedObjects}
        attentionCount={summaryCounts.attention}
        canMutate={sources.canMutate}
        hasInstance={Boolean(sources.instanceId)}
        loading={sources.listState === "loading"}
        onCreateSource={() => sources.setShowCreateForm(true)}
      />

      {/* ── Error / Message display ── */}
      {sources.error ? <p className="fg-danger">{sources.error}</p> : null}
      {sources.message ? <p>{sources.message}</p> : null}

      {/* ── Create form mode ── */}
      {showCreate ? (
        <CreateKnowledgeSourcePanel
          createForm={sources.createForm}
          setCreateForm={sources.setCreateForm}
          canMutate={sources.canMutate}
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
          canMutate={sources.canMutate}
          hasInstance={Boolean(sources.instanceId)}
          instanceId={sources.instanceId}
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
              selectedSourceId={selectedSourceId}
              listState={sources.listState}
              updateRoute={sources.updateRoute}
            />
            <KnowledgeSourceDetailPanel
              detail={sources.detail}
              detailState={sources.detailState}
              instanceId={sources.instanceId}
              canMutate={sources.canMutate}
              editForm={sources.editForm}
              setEditForm={sources.setEditForm}
              showEditForm={sources.showEditForm}
              setShowEditForm={sources.setShowEditForm}
              savingUpdate={sources.savingUpdate}
              handleUpdate={sources.handleUpdate}
            />
          </div>
        </>
      )}
    </section>
  );
}
