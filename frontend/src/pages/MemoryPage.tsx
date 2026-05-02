/**
 * Memory page — governed memory records with clear lifecycle semantics.
 *
 * Delegates to decomposed feature components in features/memory/.
 *
 * @packageDocumentation
 */

import { useState } from "react";

import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { buildMemoryPath } from "../app/workInteractionRoutes";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess } from "./workInteractionPageSupport";

import {
  useMemoryPage,
  MemorySummaryHero,
  EmptyState,
  MemoryFilterBar,
  MemoryList,
  MemoryDetailPanel,
  CreateMemoryForm,
  GovernanceActions,
  MemoryLifecycle,
} from "../features/memory";

/**
 * Memory page component.
 */
export function MemoryPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);

  const page = useMemoryPage(session, sessionReady);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const hasEntries = page.memoryEntries.length > 0;
  const showInstanceSelector = page.instances.length > 1;
  const activeInstance = page.instances.find(
    (instance) => instance.instance_id === page.instanceId,
  );

  // Compute category counts
  const categoryCounts: Record<string, number> = {
    all: page.memoryEntries.length,
    durable: page.durableCount ?? 0,
    boot: page.bootCount ?? 0,
    working: page.workingCount ?? 0,
    revoked: page.revokedCount ?? 0,
  };

  // Handle instance change
  const handleInstanceChange = (nextInstanceId: string) => {
    page.deleteParam("memoryId");
    page.setParam("instanceId", nextInstanceId);
  };

  // Handle opening the create form
  const handleOpenCreateForm = () => {
    setShowCreateForm(true);
  };

  // Handle closing the create form
  const handleCloseCreateForm = () => {
    setShowCreateForm(false);
  };

  // Handle category change
  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
  };

  // Not ready
  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Memory"
          description="ForgeFrame is restoring governed memory truth."
          question="Which context surface should open once scope resolves?"
          links={[
            {
              label: "Command Center",
              to: CONTROL_PLANE_ROUTES.dashboard,
              description: "Return to the dashboard while scope resolves.",
            },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Memory must distinguish durable truth, boot candidates, working context, and retired records."
        />
      </section>
    );
  }

  // No read access
  if (!canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Memory"
          description="This route is reserved for operators and admins who can inspect real memory governance."
          question="Which adjacent surface should remain open while memory access is outside the current permission envelope?"
          links={[
            {
              label: "Contacts",
              to: CONTROL_PLANE_ROUTES.contacts,
              description: "Inspect contact posture without opening memory records.",
            },
            {
              label: "Approvals",
              to: CONTROL_PLANE_ROUTES.approvals,
              description: "Review approvals while memory truth remains closed.",
            },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic memory shell when the session cannot inspect real context state."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Memory"
        description="Governed long-term truth with explicit scope, trust, review posture, and strict separation between durable memory, boot candidates, working context, and retired records."
        question="Which memory layer needs attention?"
        links={[
          {
            label: "Memory",
            to: buildMemoryPath({ instanceId: page.instanceId }),
            description: "Stay on the memory governance surface.",
          },
          {
            label: "Learning",
            to: `${CONTROL_PLANE_ROUTES.learning}?instanceId=${encodeURIComponent(page.instanceId)}`,
            description: "Review learning events feeding boot memory candidates.",
          },
          {
            label: "Skills",
            to: `${CONTROL_PLANE_ROUTES.skills}?instanceId=${encodeURIComponent(page.instanceId)}`,
            description: "Inspect skill usage linked to memory records.",
          },
        ]}
        badges={[
          {
            label: `${page.memoryEntries.length} memory record${page.memoryEntries.length === 1 ? "" : "s"}`,
            tone: page.memoryEntries.length > 0 ? "success" : "warning",
          },
          {
            label: canMutate ? "Admin mutation enabled" : "Read only",
            tone: canMutate ? "success" : "neutral",
          },
        ]}
        note="Working context references stay separate from durable truth. Governance actions require confirmation."
      />

      {/* Messages */}
      {page.error ? <p className="fg-danger">{page.error}</p> : null}
      {page.message ? (
        <p className="ff-memory-inline-message">{page.message}</p>
      ) : null}

      {/* Scope bar */}
      <article className="fg-card ff-memory-scope-bar" aria-label="Memory scope">
        {showInstanceSelector ? (
          <label>
            Instance
            <select
              value={page.instanceId}
              onChange={(event) => handleInstanceChange(event.target.value)}
            >
              {page.instances.map((instance) => (
                <option key={instance.instance_id} value={instance.instance_id}>
                  {instance.display_name} ({instance.instance_id})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span>
            Scope: {(activeInstance?.display_name ?? page.instanceId) || "Resolving"}
          </span>
        )}
        <span>{canMutate ? "Admin mutations available" : "Read only"}</span>
        <button
          type="button"
          className="ff-memory-create-trigger"
          disabled={!canMutate || !page.instanceId}
          onClick={handleOpenCreateForm}
        >
          Create memory
        </button>
      </article>

      {/* Summary hero */}
      <MemorySummaryHero
        totalCount={page.memoryEntries.length}
        durableCount={page.durableCount ?? 0}
        bootCount={page.bootCount ?? 0}
        workingCount={page.workingCount ?? 0}
        revokedCount={page.revokedCount ?? 0}
        canMutate={canMutate}
        hasInstance={!!page.instanceId}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        listState={page.listState}
      />

      {/* Main content: empty state or list */}
      {!hasEntries && page.listState === "success" ? (
        <EmptyState
          canMutate={canMutate}
          hasInstance={!!page.instanceId}
          onCreateMemory={handleOpenCreateForm}
        />
      ) : (
        <>
          <MemoryFilterBar
            instanceId={page.instanceId}
            instances={page.instances}
            instancesState={page.instancesState}
            activeCategory={activeCategory}
            onInstanceChange={handleInstanceChange}
            onCategoryChange={handleCategoryChange}
            categoryCounts={categoryCounts}
            showInstanceSelector={showInstanceSelector}
          />

          <div className="ff-memory-main-grid">
            <div className="fg-stack">
              <MemoryList
                entries={page.memoryEntries}
                selectedMemoryId={page.selectedMemoryId}
                activeCategory={activeCategory}
                listState={page.listState}
                hasInstance={!!page.instanceId}
                onSelectMemory={page.selectMemory}
              />

              {/* Detail panel — only when memory selected */}
              {page.selectedMemoryId ? (
                <MemoryDetailPanel
                  detail={page.detail}
                  detailState={page.detailState}
                  instanceId={page.instanceId}
                />
              ) : null}
            </div>

            {/* Governance actions — only when detail loaded */}
            {page.detail ? (
              <GovernanceActions
                detail={page.detail}
                editForm={page.editForm}
                setEditFormField={page.setEditFormField}
                correctionForm={page.correctionForm}
                setCorrectionFormField={page.setCorrectionFormField}
                deleteForm={page.deleteForm}
                setDeleteFormField={page.setDeleteFormField}
                revokeForm={page.revokeForm}
                setRevokeFormField={page.setRevokeFormField}
                handleUpdate={page.handleUpdate}
                handleCorrect={page.handleCorrect}
                handleDelete={page.handleDelete}
                handleRevoke={page.handleRevoke}
                savingUpdate={page.savingUpdate}
                savingCorrection={page.savingCorrection}
                savingDelete={page.savingDelete}
                savingRevoke={page.savingRevoke}
                canMutate={canMutate}
              />
            ) : null}
          </div>
        </>
      )}

      {/* Create memory form — hidden until explicitly opened */}
      <CreateMemoryForm
        visible={showCreateForm}
        onClose={handleCloseCreateForm}
        createForm={page.createForm}
        setCreateFormField={page.setCreateFormField}
        handleCreate={page.handleCreate}
        savingCreate={page.savingCreate}
        canMutate={canMutate}
        hasInstance={!!page.instanceId}
        instancesState={page.instancesState}
      />

      {/* Memory lifecycle explanation */}
      <MemoryLifecycle />
    </section>
  );
}
