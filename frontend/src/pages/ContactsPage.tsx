import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { PageIntro } from "../components/PageIntro";
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
import { buildInventoryPath } from "../features/contacts/utils";

/**
 * Contacts page — redesigned contact management surface.
 *
 * Shows a top-level summary hero with KPIs, then either an empty state
 * or the contact inventory table + detail panel. The create form is hidden
 * until the operator clicks "Create contact". Edit controls are hidden
 * until a contact is selected and the operator clicks "Edit contact".
 */
export function ContactsPage() {
  const contacts = useContacts();

  if (!contacts.sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Contacts"
          description="Restoring scoped contact truth before exposing route posture, provenance, and linked work records."
          question="Which contact surface should open once the active session is restored?"
          links={[
            { label: "Knowledge Sources", to: CONTROL_PLANE_ROUTES.knowledgeSources, description: "Inspect source inventory once session scope resolves." },
            { label: "Conversations", to: CONTROL_PLANE_ROUTES.conversations, description: "Return to active conversation truth while contact scope resolves." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Contacts stay instance-scoped and must show route truth, provenance, and linked conversations instead of opaque address-book rows."
        />
      </section>
    );
  }

  if (!contacts.canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Contacts"
          description="This route is reserved for operators and admins who can inspect real contact, route, and provenance truth."
          question="Which adjacent surface should remain open while contact access is outside the current permission envelope?"
          links={[
            { label: "Knowledge Sources", to: CONTROL_PLANE_ROUTES.knowledgeSources, description: "Inspect source posture without opening contact records." },
            { label: "Approvals", to: CONTROL_PLANE_ROUTES.approvals, description: "Review approvals while contact truth remains closed." },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="ForgeFrame does not render a cosmetic contact shell when the session cannot inspect real contact state."
        />
      </section>
    );
  }

  const summaryCounts = contacts.summaryCounts;
  const hasContacts = summaryCounts.total > 0;
  const showCreate = contacts.showCreateForm;

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Contacts"
        description="Persistent contacts with reachable routes, source provenance, consent posture, and links back into conversations, notifications, memory, and task truth."
        question="Can each contact actually be reached and traced back to source truth, or is work still leaking into disconnected refs and address fragments?"
        links={[
          { label: "Conversations", to: buildInventoryPath(CONTROL_PLANE_ROUTES.conversations, contacts.instanceId), description: "Open conversation truth linked to the selected contact." },
          { label: "Notifications", to: buildInventoryPath(CONTROL_PLANE_ROUTES.notifications, contacts.instanceId), description: "Inspect delivery work linked to the selected contact." },
          { label: "Knowledge Sources", to: buildInventoryPath(CONTROL_PLANE_ROUTES.knowledgeSources, contacts.instanceId), description: "Inspect the connector-backed source registry behind these contacts." },
          { label: "Memory", to: buildInventoryPath(CONTROL_PLANE_ROUTES.memory, contacts.instanceId), description: "Review memory records linked to the selected contact." },
        ]}
        badges={[
          { label: `${contacts.contacts.length} contact${contacts.contacts.length === 1 ? "" : "s"}`, tone: contacts.contacts.length > 0 ? "success" : "warning" },
          { label: contacts.canMutate ? "Admin mutation enabled" : "Read only", tone: contacts.canMutate ? "success" : "neutral" },
        ]}
        note="Contacts are first-class product records. Channel truth, provenance, and work links cannot collapse back into free-form metadata or fake CRM shells."
      />

      {/* ── Summary hero ── */}
      <ContactsSummaryHero
        totalContacts={summaryCounts.total}
        reachableCount={summaryCounts.reachable}
        missingConsentCount={summaryCounts.missingConsent}
        withRoutesCount={summaryCounts.withRoutes}
        attentionCount={summaryCounts.attention}
        canMutate={contacts.canMutate}
        hasInstance={Boolean(contacts.instanceId)}
        loading={contacts.listState === "loading"}
        onCreateContact={() => contacts.setShowCreateForm(true)}
      />

      {/* ── Error / Message display ── */}
      {contacts.error ? <p className="fg-danger">{contacts.error}</p> : null}
      {contacts.message ? <p>{contacts.message}</p> : null}

      {/* ── Create form mode ── */}
      {showCreate ? (
        <CreateContactPanel
          createForm={contacts.createForm}
          setCreateForm={contacts.setCreateForm}
          canMutate={contacts.canMutate}
          savingCreate={contacts.savingCreate}
          handleCreate={contacts.handleCreate}
          onCancel={() => {
            contacts.setCreateForm(DEFAULT_CREATE_FORM);
            contacts.setShowCreateForm(false);
          }}
        />
      ) : null}

      {/* ── Browse mode (table + detail) — show only when not in create mode ── */}
      {!showCreate && (
        <>
          <ContactFilters
            instanceId={contacts.instanceId}
            statusFilter={contacts.statusFilter}
            instances={contacts.instances}
            instancesState={contacts.instancesState}
            updateRoute={contacts.updateRoute}
          />

          {!hasContacts && contacts.listState !== "loading" ? (
            <EmptyState
              canMutate={contacts.canMutate}
              hasInstance={Boolean(contacts.instanceId)}
              instanceId={contacts.instanceId}
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
              <ContactDetailPanel
                detail={contacts.detail}
                detailState={contacts.detailState}
                instanceId={contacts.instanceId}
                canMutate={contacts.canMutate}
                editForm={contacts.editForm}
                setEditForm={contacts.setEditForm}
                savingUpdate={contacts.savingUpdate}
                handleUpdate={contacts.handleUpdate}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
