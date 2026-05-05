/**
 * Memory page — governed memory records with clear lifecycle semantics.
 *
 * Delegates to decomposed feature components in features/memory/,
 * rendered inside RegistryManagementPage template.
 *
 * @packageDocumentation
 */

import { useState } from "react";

import { useAppSession } from "../app/session";
import { getWorkInteractionAccess } from "./workInteractionPageSupport";
import { RegistryManagementPage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";

import type { SummaryStripItem } from "../components/ui/SummaryStrip";

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

  // ── Scope config ───────────────────────────────────────────
  const scopeLabel = activeInstance?.display_name ?? (page.instanceId || undefined);
  const scope = scopeLabel
    ? {
        label: scopeLabel,
        onChange: () => {
          page.deleteParam("memoryId");
        },
      }
    : undefined;

  // ── Summary items ──────────────────────────────────────────
  const summaryItems: SummaryStripItem[] = [
    { key: "total", label: "Total", value: page.memoryEntries.length, tone: page.memoryEntries.length > 0 ? "success" as const : undefined },
    ...((page.durableCount ?? 0) > 0 ? [{ key: "durable" as const, label: "Durable" as const, value: page.durableCount ?? 0 }] : []),
    ...((page.bootCount ?? 0) > 0 ? [{ key: "boot" as const, label: "Boot" as const, value: page.bootCount ?? 0 }] : []),
    ...((page.workingCount ?? 0) > 0 ? [{ key: "working" as const, label: "Working" as const, value: page.workingCount ?? 0 }] : []),
    ...((page.revokedCount ?? 0) > 0 ? [{ key: "revoked" as const, label: "Revoked" as const, value: page.revokedCount ?? 0, tone: "warning" as const }] : []),
  ];

  // ── Attention items ────────────────────────────────────────
  const attentionItems: AttentionPayload[] = [];
  if (page.error) {
    attentionItems.push({ key: "memory-error", level: "primary_blocker", title: page.error });
  }
  if (page.message) {
    attentionItems.push({ key: "memory-message", level: "informational", title: page.message });
  }
  if (!canMutate) {
    attentionItems.push({ key: "read-only", level: "informational", title: "Read only — mutation not available" });
  }

  // ── Access gate (early return) ─────────────────────────────
  if (!sessionReady) {
    return (
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Memory"
        description="ForgeFrame is restoring governed memory truth."
      />
    );
  }

  if (!canRead) {
    return (
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Memory"
        description="This route is reserved for operators and admins who can inspect real memory governance."
        isEmpty
        emptyTitle="Memory access unavailable"
        emptyDescription="This session does not hold the required permissions to inspect memory governance records."
      />
    );
  }

  return (
    <RegistryManagementPage
      eyebrow="Work Interaction"
      title="Memory"
      description="Governed long-term truth with explicit scope, trust, review posture, and strict separation between durable memory, boot candidates, working context, and retired records."
      scope={scope}
      attentionItems={attentionItems}
      summaryItems={summaryItems}
      actions={canMutate && page.instanceId
        ? [
            {
              label: "Create memory",
              kind: "primary",
              intent: "configure",
              onClick: handleOpenCreateForm,
              disabled: !canMutate || !page.instanceId,
            },
          ]
        : undefined}
      selectedItemContent={
        page.selectedMemoryId ? (
          <MemoryDetailPanel
            detail={page.detail}
            detailState={page.detailState}
            instanceId={page.instanceId}
          />
        ) : null
      }
      hasSelection={!!page.selectedMemoryId}
      emptyDetailHint="Select a memory entry from the table to inspect its governance details."
      diagnostics={
        <AdvancedDiagnostics title="Memory diagnostics">
          <span className="text-meta text-muted italic">No diagnostic data available.</span>
        </AdvancedDiagnostics>
      }
    >
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
    </RegistryManagementPage>
  );
}
