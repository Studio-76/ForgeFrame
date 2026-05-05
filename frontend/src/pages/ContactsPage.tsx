import { RegistryManagementPage } from "../components/page-templates";
import type { AttentionPayload } from "../components/ui/models/attention";
import type { SummaryStripItem } from "../components/ui/SummaryStrip";
import { AdvancedDiagnostics } from "../components/ui/AdvancedDiagnostics";
import type { ContactSummaryCounts } from "../features/contacts/types";
import {
  ContactDetailPanel,
  ContactFilters,
  ContactTable,
  ContactsSummaryHero,
  CreateContactPanel,
  DEFAULT_CREATE_FORM,
  EmptyState,
  useContacts,
} from "../features/contacts";

/**
 * Contacts page — redesigned contact management surface.
 *
 * Shows a top-level summary hero with KPIs, then either an empty state
 * or the contact inventory table. The create form is hidden until the
 * operator clicks "Create contact". Edit controls are hidden until a
 * contact is selected and the operator clicks "Edit contact".
 * Rendered inside RegistryManagementPage template.
 */
export function ContactsPage() {
  const contacts = useContacts();

  const { canMutate, instanceId, sessionReady, canRead } = contacts;
  const summaryCounts: ContactSummaryCounts = contacts.summaryCounts;
  const hasContacts = summaryCounts.total > 0;
  const showCreate = contacts.showCreateForm;

  // ── Scope config ───────────────────────────────────────────
  const scope = instanceId
    ? {
        label: instanceId,
      }
    : undefined;

  // ── Summary items ──────────────────────────────────────────
  const summaryItems: SummaryStripItem[] = [
    { key: "total", label: "Total", value: summaryCounts.total, tone: summaryCounts.total > 0 ? "success" as const : undefined },
    ...(summaryCounts.active > 0 ? [{ key: "active" as const, label: "Active" as const, value: summaryCounts.active, tone: "success" as const }] : []),
    ...(summaryCounts.reachable > 0 ? [{ key: "reachable" as const, label: "Reachable" as const, value: summaryCounts.reachable }] : []),
    ...(summaryCounts.withRoutes > 0 ? [{ key: "with-routes" as const, label: "With routes" as const, value: summaryCounts.withRoutes }] : []),
    ...(summaryCounts.attention > 0 ? [{ key: "attention" as const, label: "Attention" as const, value: summaryCounts.attention, tone: "warning" as const }] : []),
    ...(summaryCounts.missingConsent > 0 ? [{ key: "missing-consent" as const, label: "Missing consent" as const, value: summaryCounts.missingConsent, tone: "warning" as const }] : []),
  ];

  // ── Attention items ────────────────────────────────────────
  const attentionItems: AttentionPayload[] = [];
  if (contacts.error) {
    attentionItems.push({ key: "contacts-error", level: "primary_blocker", title: contacts.error });
  }
  if (contacts.message) {
    attentionItems.push({ key: "contacts-message", level: "informational", title: contacts.message });
  }
  if (!canMutate) {
    attentionItems.push({ key: "read-only", level: "informational", title: "Read only — mutation not available" });
  }

  // ── Access gate (early return) ─────────────────────────────
  if (!sessionReady) {
    return (
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Contacts"
        description="Restoring scoped contact truth before exposing route posture, provenance, and linked work records."
      />
    );
  }

  if (!canRead) {
    return (
      <RegistryManagementPage
        eyebrow="Work Interaction"
        title="Contacts"
        description="This route is reserved for operators and admins who can inspect real contact, route, and provenance truth."
        isEmpty
        emptyTitle="Contact access unavailable"
        emptyDescription="This session does not hold the required permissions to inspect contact records."
      />
    );
  }

  return (
    <RegistryManagementPage
      eyebrow="Work Interaction"
      title="Contacts"
      description="Persistent contacts with reachable routes, source provenance, consent posture, and links back into conversations, notifications, memory, and task truth."
      scope={scope}
      attentionItems={attentionItems}
      summaryItems={summaryItems}
      actions={canMutate && instanceId
        ? [
            {
              label: "Create contact",
              kind: "primary",
              intent: "configure",
              onClick: () => contacts.setShowCreateForm(true),
              disabled: !canMutate || !instanceId,
            },
          ]
        : undefined}
      selectedItemContent={
        <ContactDetailPanel
          detail={contacts.detail}
          detailState={contacts.detailState}
          instanceId={instanceId}
          canMutate={canMutate}
          editForm={contacts.editForm}
          setEditForm={contacts.setEditForm}
          savingUpdate={contacts.savingUpdate}
          handleUpdate={contacts.handleUpdate}
        />
      }
      hasSelection={!!contacts.selectedContactId}
      emptyDetailHint="Select a contact from the table to inspect its details."
      diagnostics={
        <AdvancedDiagnostics title="Contact diagnostics">
          <span className="text-meta text-muted italic">No diagnostic data available.</span>
        </AdvancedDiagnostics>
      }
    >
      {/* ── Summary hero ── */}
      <ContactsSummaryHero
        totalContacts={summaryCounts.total}
        reachableCount={summaryCounts.reachable}
        missingConsentCount={summaryCounts.missingConsent}
        withRoutesCount={summaryCounts.withRoutes}
        attentionCount={summaryCounts.attention}
        canMutate={canMutate}
        hasInstance={Boolean(instanceId)}
        loading={contacts.listState === "loading"}
        onCreateContact={() => contacts.setShowCreateForm(true)}
      />

      {/* ── Create form mode ── */}
      {showCreate ? (
        <CreateContactPanel
          createForm={contacts.createForm}
          setCreateForm={contacts.setCreateForm}
          canMutate={canMutate}
          savingCreate={contacts.savingCreate}
          handleCreate={contacts.handleCreate}
          onCancel={() => {
            contacts.setCreateForm(DEFAULT_CREATE_FORM);
            contacts.setShowCreateForm(false);
          }}
        />
      ) : null}

      {/* ── Browse mode (table) — show only when not in create mode ── */}
      {!showCreate && (
        <>
          <ContactFilters
            instanceId={instanceId}
            statusFilter={contacts.statusFilter}
            instances={contacts.instances}
            instancesState={contacts.instancesState}
            updateRoute={contacts.updateRoute}
          />

          {!hasContacts && contacts.listState !== "loading" ? (
            <EmptyState
              canMutate={canMutate}
              hasInstance={Boolean(instanceId)}
              instanceId={instanceId}
              onCreateContact={() => contacts.setShowCreateForm(true)}
            />
          ) : (
            <div className="fg-grid ff-contacts-browse-layout">
              <ContactTable
                contacts={contacts.contacts}
                selectedContactId={contacts.selectedContactId}
                listState={contacts.listState}
                updateRoute={contacts.updateRoute}
              />
            </div>
          )}
        </>
      )}
    </RegistryManagementPage>
  );
}
