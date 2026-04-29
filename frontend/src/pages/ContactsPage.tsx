import { startTransition, useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  createContact,
  fetchContactDetail,
  fetchContacts,
  fetchInstances,
  updateContact,
  type ContactDetail,
  type ContactRouteStatus,
  type ContactStatus,
  type ContactSummary,
  type VisibilityScope,
} from "../api/admin";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import {
  buildConversationPath,
  buildKnowledgeSourcePath,
  buildMemoryPath,
  buildNotificationPath,
  buildTaskPath,
} from "../app/workInteractionRoutes";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";
import { getWorkInteractionAccess, normalizeOptional, parseJsonObject, type LoadState } from "./workInteractionPageSupport";

const STATUS_OPTIONS: Array<ContactStatus | "all"> = ["all", "active", "snoozed", "archived"];
const VISIBILITY_OPTIONS: VisibilityScope[] = ["instance", "team", "personal", "restricted"];

const DEFAULT_STRUCTURED_FIELDS = {
  contactRef: "",
  sourceId: "",
  displayName: "",
  primaryEmail: "",
  secondaryEmail: "",
  primaryPhone: "",
  secondaryPhone: "",
  slackHandle: "",
  organization: "",
  title: "",
  status: "active" as ContactStatus,
  visibilityScope: "team" as VisibilityScope,
  consentStatus: "unknown",
  consentCapturedAt: "",
  consentNote: "",
  provenanceProvider: "",
  provenanceImportReference: "",
  provenanceImportedAt: "",
  provenanceLastVerifiedAt: "",
  provenanceNote: "",
  visibilityNote: "",
  advancedMetadataJson: "{}",
};

const DEFAULT_CREATE_FORM = {
  contactId: "",
  ...DEFAULT_STRUCTURED_FIELDS,
};

const DEFAULT_EDIT_FORM = {
  ...DEFAULT_STRUCTURED_FIELDS,
};

function formatTimestamp(value: string | null | undefined, fallback = "Not recorded"): string {
  return value && value.trim() ? value : fallback;
}

function contactStatusTone(status: ContactStatus): "success" | "warning" | "neutral" {
  if (status === "active") {
    return "success";
  }
  if (status === "snoozed") {
    return "warning";
  }
  return "neutral";
}

function routeStatusTone(status: ContactRouteStatus): "success" | "warning" | "danger" {
  if (status === "reachable") {
    return "success";
  }
  if (status === "blocked") {
    return "danger";
  }
  return "warning";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function cloneMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
}

function normalizedAddress(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function cleanupSection(section: Record<string, unknown>, keys: string[]) {
  keys.forEach((key) => {
    const value = section[key];
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
      delete section[key];
    }
  });
}

function splitContactMetadata(detail: ContactDetail) {
  const advanced = cloneMetadata(detail.metadata);
  let secondaryEmail = "";
  let secondaryPhone = "";
  let slackHandle = "";

  const advancedChannels = Array.isArray(advanced.channels) ? advanced.channels : [];
  const remainingChannels: unknown[] = [];

  advancedChannels.forEach((item) => {
    const channel = asRecord(item);
    const kind = readString(channel?.kind ?? channel?.type).trim().toLowerCase();
    const address = readString(channel?.address ?? channel?.value ?? channel?.target ?? channel?.handle).trim();
    if (!channel || !address) {
      remainingChannels.push(item);
      return;
    }
    if (kind === "email" && !secondaryEmail && normalizedAddress(address) !== normalizedAddress(detail.primary_email)) {
      secondaryEmail = address;
      return;
    }
    if (kind === "phone" && !secondaryPhone && normalizedAddress(address) !== normalizedAddress(detail.primary_phone)) {
      secondaryPhone = address;
      return;
    }
    if (kind === "slack" && !slackHandle) {
      slackHandle = address;
      return;
    }
    remainingChannels.push(item);
  });

  if (remainingChannels.length > 0) {
    advanced.channels = remainingChannels;
  } else {
    delete advanced.channels;
  }

  if (!secondaryEmail) {
    secondaryEmail = readString(advanced.secondary_email || advanced.alternate_email).trim();
    delete advanced.secondary_email;
    delete advanced.alternate_email;
  }

  if (!secondaryPhone) {
    secondaryPhone = readString(advanced.secondary_phone || advanced.alternate_phone).trim();
    delete advanced.secondary_phone;
    delete advanced.alternate_phone;
  }

  if (!slackHandle) {
    slackHandle = readString(advanced.slack_handle || advanced.slack_channel).trim();
    delete advanced.slack_handle;
    delete advanced.slack_channel;
  }

  const advancedConsent = asRecord(advanced.consent);
  if (advancedConsent) {
    delete advancedConsent.status;
    delete advancedConsent.state;
    delete advancedConsent.captured_at;
    delete advancedConsent.updated_at;
    delete advancedConsent.note;
    delete advancedConsent.policy_basis;
    cleanupSection(advancedConsent, Object.keys(advancedConsent));
    if (Object.keys(advancedConsent).length === 0) {
      delete advanced.consent;
    } else {
      advanced.consent = advancedConsent;
    }
  }
  delete advanced.consent_status;
  delete advanced.consent_captured_at;
  delete advanced.consent_note;

  const advancedProvenance = asRecord(advanced.provenance);
  if (advancedProvenance) {
    delete advancedProvenance.provider;
    delete advancedProvenance.system;
    delete advancedProvenance.import_reference;
    delete advancedProvenance.external_id;
    delete advancedProvenance.record_id;
    delete advancedProvenance.imported_at;
    delete advancedProvenance.last_verified_at;
    delete advancedProvenance.note;
    delete advancedProvenance.summary;
    cleanupSection(advancedProvenance, Object.keys(advancedProvenance));
    if (Object.keys(advancedProvenance).length === 0) {
      delete advanced.provenance;
    } else {
      advanced.provenance = advancedProvenance;
    }
  }
  delete advanced.source_provider;
  delete advanced.imported_at;
  delete advanced.last_verified_at;
  delete advanced.source_note;

  const advancedVisibility = asRecord(advanced.visibility);
  if (advancedVisibility) {
    delete advancedVisibility.note;
    delete advancedVisibility.summary;
    cleanupSection(advancedVisibility, Object.keys(advancedVisibility));
    if (Object.keys(advancedVisibility).length === 0) {
      delete advanced.visibility;
    } else {
      advanced.visibility = advancedVisibility;
    }
  }
  delete advanced.visibility_note;

  return {
    secondaryEmail,
    secondaryPhone,
    slackHandle,
    consentStatus: detail.consent.status,
    consentCapturedAt: detail.consent.captured_at ?? "",
    consentNote: detail.consent.note ?? "",
    provenanceProvider: detail.provenance.provider ?? "",
    provenanceImportReference: detail.provenance.import_reference ?? "",
    provenanceImportedAt: detail.provenance.imported_at ?? "",
    provenanceLastVerifiedAt: detail.provenance.last_verified_at ?? "",
    provenanceNote: detail.provenance.note ?? "",
    visibilityNote: detail.visibility_note ?? "",
    advancedMetadataJson: JSON.stringify(advanced, null, 2),
  };
}

function buildContactMetadata(form: typeof DEFAULT_CREATE_FORM | typeof DEFAULT_EDIT_FORM): Record<string, unknown> {
  const metadata = parseJsonObject(form.advancedMetadataJson, "Contact advanced metadata");
  const channels = Array.isArray(metadata.channels) ? [...metadata.channels] : [];
  delete metadata.channels;

  if (normalizeOptional(form.secondaryEmail)) {
    channels.push({
      kind: "email",
      label: "Secondary email",
      address: form.secondaryEmail.trim(),
      source: "operator",
    });
  }
  if (normalizeOptional(form.secondaryPhone)) {
    channels.push({
      kind: "phone",
      label: "Secondary phone",
      address: form.secondaryPhone.trim(),
      source: "operator",
    });
  }
  if (normalizeOptional(form.slackHandle)) {
    channels.push({
      kind: "slack",
      label: "Slack",
      address: form.slackHandle.trim(),
      source: "operator",
    });
  }
  if (channels.length > 0) {
    metadata.channels = channels;
  }

  const consent = { ...(asRecord(metadata.consent) ?? {}) };
  delete metadata.consent;
  if (normalizeOptional(form.consentStatus)) {
    consent.status = form.consentStatus.trim();
  }
  if (normalizeOptional(form.consentCapturedAt)) {
    consent.captured_at = form.consentCapturedAt.trim();
  }
  if (normalizeOptional(form.consentNote)) {
    consent.note = form.consentNote.trim();
  }
  cleanupSection(consent, Object.keys(consent));
  if (Object.keys(consent).length > 0) {
    metadata.consent = consent;
  }

  const provenance = { ...(asRecord(metadata.provenance) ?? {}) };
  delete metadata.provenance;
  if (normalizeOptional(form.provenanceProvider)) {
    provenance.provider = form.provenanceProvider.trim();
  }
  if (normalizeOptional(form.provenanceImportReference)) {
    provenance.import_reference = form.provenanceImportReference.trim();
  }
  if (normalizeOptional(form.provenanceImportedAt)) {
    provenance.imported_at = form.provenanceImportedAt.trim();
  }
  if (normalizeOptional(form.provenanceLastVerifiedAt)) {
    provenance.last_verified_at = form.provenanceLastVerifiedAt.trim();
  }
  if (normalizeOptional(form.provenanceNote)) {
    provenance.note = form.provenanceNote.trim();
  }
  cleanupSection(provenance, Object.keys(provenance));
  if (Object.keys(provenance).length > 0) {
    metadata.provenance = provenance;
  }

  const visibility = { ...(asRecord(metadata.visibility) ?? {}) };
  delete metadata.visibility;
  if (normalizeOptional(form.visibilityNote)) {
    visibility.note = form.visibilityNote.trim();
  }
  cleanupSection(visibility, Object.keys(visibility));
  if (Object.keys(visibility).length > 0) {
    metadata.visibility = visibility;
  }

  return metadata;
}

function channelInventoryLabel(contact: ContactSummary): string {
  if (contact.channels.length === 0) {
    return "No routes recorded";
  }
  const visibleRoutes = contact.channels.slice(0, 2).map((channel) => `${channel.kind}: ${channel.address}`);
  const extraCount = contact.channels.length - visibleRoutes.length;
  return `${visibleRoutes.join(" · ")}${extraCount > 0 ? ` · +${extraCount} more` : ""}`;
}

export function ContactsPage() {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedContactId = searchParams.get("contactId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as ContactStatus | "all" | "") || "all";

  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => {
      setSearchParams(next, { replace });
    });
  };

  useEffect(() => {
    if (!canRead) {
      setInstances([]);
      return;
    }

    let cancelled = false;
    setInstancesState("loading");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setInstances(payload.instances);
        setInstancesState("success");
        if (!instanceId && payload.instances[0]?.instance_id) {
          updateRoute((next) => {
            next.set("instanceId", payload.instances[0].instance_id);
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setInstances([]);
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Contact instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  useEffect(() => {
    if (!canRead || !instanceId) {
      setListState("idle");
      setContacts([]);
      setDetail(null);
      return;
    }

    let cancelled = false;
    setListState("loading");

    void fetchContacts(instanceId, { status: statusFilter, limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setContacts(payload.contacts);
        setListState("success");
        setError("");

        const nextContactId = payload.contacts.some((contact) => contact.contact_id === selectedContactId)
          ? selectedContactId
          : payload.contacts[0]?.contact_id ?? "";
        if (nextContactId !== selectedContactId) {
          updateRoute((next) => {
            if (nextContactId) {
              next.set("contactId", nextContactId);
            } else {
              next.delete("contactId");
            }
          }, true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setContacts([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Contact inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedContactId, statusFilter]);

  useEffect(() => {
    if (!canRead || !instanceId || !selectedContactId) {
      setDetailState("idle");
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailState("loading");

    void fetchContactDetail(selectedContactId, instanceId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setDetail(payload.contact);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Contact detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedContactId]);

  useEffect(() => {
    if (!detail) {
      setEditForm(DEFAULT_EDIT_FORM);
      return;
    }

    const structuredMetadata = splitContactMetadata(detail);
    setEditForm({
      contactRef: detail.contact_ref,
      sourceId: detail.source_id ?? "",
      displayName: detail.display_name,
      primaryEmail: detail.primary_email ?? "",
      secondaryEmail: structuredMetadata.secondaryEmail,
      primaryPhone: detail.primary_phone ?? "",
      secondaryPhone: structuredMetadata.secondaryPhone,
      slackHandle: structuredMetadata.slackHandle,
      organization: detail.organization ?? "",
      title: detail.title ?? "",
      status: detail.status,
      visibilityScope: detail.visibility_scope,
      consentStatus: structuredMetadata.consentStatus,
      consentCapturedAt: structuredMetadata.consentCapturedAt,
      consentNote: structuredMetadata.consentNote,
      provenanceProvider: structuredMetadata.provenanceProvider,
      provenanceImportReference: structuredMetadata.provenanceImportReference,
      provenanceImportedAt: structuredMetadata.provenanceImportedAt,
      provenanceLastVerifiedAt: structuredMetadata.provenanceLastVerifiedAt,
      provenanceNote: structuredMetadata.provenanceNote,
      visibilityNote: structuredMetadata.visibilityNote,
      advancedMetadataJson: structuredMetadata.advancedMetadataJson,
    });
  }, [detail]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId) {
      return;
    }

    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createContact(instanceId, {
        contact_id: normalizeOptional(createForm.contactId),
        contact_ref: normalizeOptional(createForm.contactRef),
        source_id: normalizeOptional(createForm.sourceId),
        display_name: createForm.displayName.trim(),
        primary_email: normalizeOptional(createForm.primaryEmail),
        primary_phone: normalizeOptional(createForm.primaryPhone),
        organization: normalizeOptional(createForm.organization),
        title: normalizeOptional(createForm.title),
        status: createForm.status,
        visibility_scope: createForm.visibilityScope,
        metadata: buildContactMetadata(createForm),
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      updateRoute((next) => {
        next.set("contactId", payload.contact.contact_id);
      });
      setMessage(`Contact ${payload.contact.contact_id} created.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Contact creation failed.");
    } finally {
      setSavingCreate(false);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !instanceId || !detail) {
      return;
    }

    setSavingUpdate(true);
    setError("");
    setMessage("");
    try {
      const payload = await updateContact(instanceId, detail.contact_id, {
        contact_ref: normalizeOptional(editForm.contactRef),
        source_id: normalizeOptional(editForm.sourceId),
        display_name: editForm.displayName.trim(),
        primary_email: normalizeOptional(editForm.primaryEmail),
        primary_phone: normalizeOptional(editForm.primaryPhone),
        organization: normalizeOptional(editForm.organization),
        title: normalizeOptional(editForm.title),
        status: editForm.status,
        visibility_scope: editForm.visibilityScope,
        metadata: buildContactMetadata(editForm),
      });
      setMessage(`Contact ${payload.contact.contact_id} updated.`);
      setRefreshNonce((current) => current + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Contact update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Contacts"
          description="ForgeFrame is restoring scoped contact truth before exposing route posture, provenance, and linked work records."
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

  if (!canRead) {
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

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Contacts"
        description="Persistent contacts with reachable routes, source provenance, consent posture, and links back into conversations, notifications, memory, and task truth."
        question="Can each contact actually be reached and traced back to source truth, or is work still leaking into disconnected refs and address fragments?"
        links={[
          { label: "Contacts", to: CONTROL_PLANE_ROUTES.contacts, description: "Stay on the contact inventory and detail surface." },
          { label: "Conversations", to: CONTROL_PLANE_ROUTES.conversations, description: "Open conversation truth linked to the selected contact." },
          { label: "Notifications", to: CONTROL_PLANE_ROUTES.notifications, description: "Inspect delivery work linked to the selected contact." },
          { label: "Knowledge Sources", to: CONTROL_PLANE_ROUTES.knowledgeSources, description: "Inspect the connector-backed source registry behind these contacts." },
          { label: "Memory", to: CONTROL_PLANE_ROUTES.memory, description: "Review memory records linked to the selected contact." },
        ]}
        badges={[
          { label: `${contacts.length} contact${contacts.length === 1 ? "" : "s"}`, tone: contacts.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="Contacts are first-class product records. Channel truth, provenance, and work links cannot collapse back into free-form metadata or fake CRM shells."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <h3>Scope and filter</h3>
            <p className="fg-muted">Choose the instance boundary, then constrain the contact inventory by lifecycle state.</p>
          </div>
          <span className="fg-pill" data-tone={instancesState === "success" ? "success" : instancesState === "error" ? "danger" : "neutral"}>{instancesState}</span>
        </div>
        <div className="fg-inline-form">
          <label>
            Instance
            <select
              aria-label="Contact instance"
              value={instanceId}
              onChange={(event) => updateRoute((next) => {
                next.set("instanceId", event.target.value);
                next.delete("contactId");
              })}
            >
              {instances.map((instance) => (
                <option key={instance.instance_id} value={instance.instance_id}>
                  {instance.display_name} ({instance.instance_id})
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="Contact status filter"
              value={statusFilter}
              onChange={(event) => updateRoute((next) => {
                const nextValue = event.target.value;
                if (nextValue === "all") {
                  next.delete("status");
                } else {
                  next.set("status", nextValue);
                }
                next.delete("contactId");
              })}
            >
              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </article>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Contact inventory</h3>
              <p className="fg-muted">Each row shows source truth, reachable channels, and the latest real contact activity.</p>
            </div>
            <span className="fg-pill" data-tone={listState === "success" ? "success" : listState === "error" ? "danger" : "neutral"}>{listState}</span>
          </div>

          {listState === "loading" ? <p className="fg-muted">Loading contact inventory.</p> : null}
          {listState === "success" && contacts.length === 0 ? <p className="fg-muted">No contacts matched the selected filters.</p> : null}

          {contacts.length > 0 ? (
            <div className="fg-table-wrap">
              <table className="fg-table" aria-label="Contact inventory">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Organization</th>
                    <th>Source</th>
                    <th>Channels</th>
                    <th>Last contact</th>
                    <th>Linked conversations</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.contact_id} className={contact.contact_id === selectedContactId ? "is-selected" : undefined}>
                      <td>
                        <button
                          className="fg-table-trigger"
                          type="button"
                          onClick={() => updateRoute((next) => {
                            next.set("contactId", contact.contact_id);
                          })}
                        >
                          {contact.display_name}
                        </button>
                        <div className="fg-muted">
                          <span className="fg-code">{contact.contact_id}</span>
                          {" · "}
                          <span className="fg-pill" data-tone={contactStatusTone(contact.status)}>{contact.status}</span>
                        </div>
                        {contact.route_warnings[0] ? <div className="fg-danger">{contact.route_warnings[0]}</div> : null}
                      </td>
                      <td>
                        <div>{contact.organization ?? "Not recorded"}</div>
                        <div className="fg-muted">{contact.title ?? "No title"} · {contact.visibility_scope}</div>
                      </td>
                      <td>
                        <div>{contact.source_label ?? "Unlinked"}</div>
                        <div className="fg-muted">{contact.source_kind ?? "No source kind"}</div>
                      </td>
                      <td>
                        <div>{channelInventoryLabel(contact)}</div>
                        <div className="fg-muted">{contact.reachable_channel_count} reachable route{contact.reachable_channel_count === 1 ? "" : "s"}</div>
                      </td>
                      <td>{formatTimestamp(contact.last_contact_at, "No contact recorded")}</td>
                      <td>
                        <div>{contact.conversation_count}</div>
                        <div className="fg-muted">memory {contact.memory_count}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Contact detail</h3>
              <p className="fg-muted">Route truth, source provenance, consent posture, and linked work converge here.</p>
            </div>
            {detail ? <span className="fg-pill">{detail.contact_id}</span> : null}
          </div>

          {detailState === "idle" ? <p className="fg-muted">Select a contact to inspect channel routes, provenance, and linked work truth.</p> : null}
          {detailState === "loading" ? <p className="fg-muted">Loading contact detail.</p> : null}

          {detail ? (
            <div className="fg-stack">
              {detail.route_warnings.length > 0 ? (
                <article className="fg-subcard">
                  <h4>Route warnings</h4>
                  <ul className="fg-list fg-danger">
                    {detail.route_warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </article>
              ) : null}

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Summary</h4>
                  <ul className="fg-list">
                    <li>Ref: {detail.contact_ref}</li>
                    <li>Status: {detail.status}</li>
                    <li>Visibility: {detail.visibility_scope}</li>
                    <li>Last contact: {formatTimestamp(detail.last_contact_at, "No contact recorded")}</li>
                    <li>Organization: {detail.organization ?? "Not recorded"}</li>
                    <li>Title: {detail.title ?? "Not recorded"}</li>
                  </ul>
                  <div className="fg-actions">
                    <Link className="fg-nav-link" to={buildConversationPath({ instanceId })}>Open conversations</Link>
                    <Link className="fg-nav-link" to={buildNotificationPath({ instanceId })}>Open notifications</Link>
                  </div>
                </article>

                <article className="fg-subcard">
                  <h4>Source and provenance</h4>
                  <ul className="fg-list">
                    <li>Source: {detail.source?.label ?? detail.source_label ?? "Unlinked"}</li>
                    <li>Source kind: {detail.source?.source_kind ?? detail.source_kind ?? "Not recorded"}</li>
                    <li>Provider: {detail.provenance.provider ?? "Not recorded"}</li>
                    <li>Import reference: {detail.provenance.import_reference ?? "Not recorded"}</li>
                    <li>Imported at: {formatTimestamp(detail.provenance.imported_at, "Not recorded")}</li>
                    <li>Last verified: {formatTimestamp(detail.provenance.last_verified_at, "Not recorded")}</li>
                    <li>Provenance note: {detail.provenance.note ?? "Not recorded"}</li>
                  </ul>
                  <div className="fg-actions">
                    {detail.source ? (
                      <Link className="fg-nav-link" to={buildKnowledgeSourcePath({ instanceId, sourceId: detail.source.source_id })}>Open source</Link>
                    ) : null}
                  </div>
                </article>

                <article className="fg-subcard">
                  <h4>Consent and visibility</h4>
                  <ul className="fg-list">
                    <li>Consent status: {detail.consent.status}</li>
                    <li>Consent captured: {formatTimestamp(detail.consent.captured_at, "Not recorded")}</li>
                    <li>Consent note: {detail.consent.note ?? "Not recorded"}</li>
                    <li>Visibility scope: {detail.visibility_scope}</li>
                    <li>Visibility note: {detail.visibility_note ?? "Not recorded"}</li>
                  </ul>
                </article>
              </div>

              <article className="fg-subcard">
                <h4>Channel routes</h4>
                {detail.channels.length === 0 ? <p className="fg-muted">No channel addresses are recorded for this contact.</p> : (
                  <ul className="fg-list">
                    {detail.channels.map((channel, index) => (
                      <li key={`${channel.kind}:${channel.address}:${index}`}>
                        <span className="fg-pill" data-tone={routeStatusTone(channel.route_status)}>{channel.route_status}</span>
                        {" "}
                        <strong>{channel.label}</strong>
                        {" · "}
                        {channel.kind}
                        {" · "}
                        {channel.address}
                        {channel.is_primary ? " · primary" : ""}
                        {channel.source ? ` · ${channel.source}` : ""}
                        {channel.warning ? ` · ${channel.warning}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <div className="fg-card-grid">
                <article className="fg-subcard">
                  <h4>Linked conversations</h4>
                  {detail.recent_conversations.length === 0 ? <p className="fg-muted">No conversations are linked to this contact.</p> : (
                    <ul className="fg-list">
                      {detail.recent_conversations.map((conversation) => (
                        <li key={conversation.record_id}>
                          <Link to={buildConversationPath({ instanceId, conversationId: conversation.record_id })}>{conversation.label}</Link>
                          {conversation.status ? ` · ${conversation.status}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="fg-subcard">
                  <h4>Linked tasks</h4>
                  {detail.recent_tasks.length === 0 ? <p className="fg-muted">No tasks are linked to this contact.</p> : (
                    <ul className="fg-list">
                      {detail.recent_tasks.map((task) => (
                        <li key={task.record_id}>
                          <Link to={buildTaskPath({ instanceId, taskId: task.record_id })}>{task.label}</Link>
                          {task.status ? ` · ${task.status}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="fg-subcard">
                  <h4>Linked notifications</h4>
                  {detail.recent_notifications.length === 0 ? <p className="fg-muted">No notifications are linked to this contact.</p> : (
                    <ul className="fg-list">
                      {detail.recent_notifications.map((notification) => (
                        <li key={notification.record_id}>
                          <Link to={buildNotificationPath({ instanceId, notificationId: notification.record_id })}>{notification.label}</Link>
                          {notification.status ? ` · ${notification.status}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="fg-subcard">
                  <h4>Memory references</h4>
                  {detail.recent_memory.length === 0 ? <p className="fg-muted">No memory entries are linked to this contact.</p> : (
                    <ul className="fg-list">
                      {detail.recent_memory.map((memory) => (
                        <li key={memory.memory_id}>
                          <Link to={buildMemoryPath({ instanceId, memoryId: memory.memory_id })}>{memory.title}</Link>
                          {" · "}{memory.memory_kind}{" · "}{memory.status}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>
            </div>
          ) : null}
        </article>
      </div>

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create contact</h3>
              <p className="fg-muted">Create a durable contact record with structured routes, consent, and provenance fields. Free JSON stays in Advanced only.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <div className="fg-grid fg-grid-compact">
              <label>
                Contact ID
                <input value={createForm.contactId} onChange={(event) => setCreateForm((current) => ({ ...current, contactId: event.target.value }))} placeholder="contact_acme_ops" />
              </label>
              <label>
                Contact ref
                <input value={createForm.contactRef} onChange={(event) => setCreateForm((current) => ({ ...current, contactRef: event.target.value }))} placeholder="contact://acme/ops" />
              </label>
              <label>
                Source ID
                <input value={createForm.sourceId} onChange={(event) => setCreateForm((current) => ({ ...current, sourceId: event.target.value }))} placeholder="source_mail_primary" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Display name
                <input value={createForm.displayName} onChange={(event) => setCreateForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Pat Morgan" />
              </label>
              <label>
                Organization
                <input value={createForm.organization} onChange={(event) => setCreateForm((current) => ({ ...current, organization: event.target.value }))} placeholder="Acme GmbH" />
              </label>
              <label>
                Title
                <input value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} placeholder="Operations Lead" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Primary email
                <input value={createForm.primaryEmail} onChange={(event) => setCreateForm((current) => ({ ...current, primaryEmail: event.target.value }))} placeholder="pat@example.com" />
              </label>
              <label>
                Secondary email
                <input value={createForm.secondaryEmail} onChange={(event) => setCreateForm((current) => ({ ...current, secondaryEmail: event.target.value }))} placeholder="ops@example.com" />
              </label>
              <label>
                Slack handle
                <input value={createForm.slackHandle} onChange={(event) => setCreateForm((current) => ({ ...current, slackHandle: event.target.value }))} placeholder="@pat-morgan" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Primary phone
                <input value={createForm.primaryPhone} onChange={(event) => setCreateForm((current) => ({ ...current, primaryPhone: event.target.value }))} placeholder="+49-30-555-100" />
              </label>
              <label>
                Secondary phone
                <input value={createForm.secondaryPhone} onChange={(event) => setCreateForm((current) => ({ ...current, secondaryPhone: event.target.value }))} placeholder="+49-30-555-200" />
              </label>
              <label>
                Status
                <select value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as ContactStatus }))}>
                  {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Visibility scope
                <select value={createForm.visibilityScope} onChange={(event) => setCreateForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}>
                  {VISIBILITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                Consent status
                <input value={createForm.consentStatus} onChange={(event) => setCreateForm((current) => ({ ...current, consentStatus: event.target.value }))} placeholder="explicit_opt_in" />
              </label>
              <label>
                Consent captured at
                <input value={createForm.consentCapturedAt} onChange={(event) => setCreateForm((current) => ({ ...current, consentCapturedAt: event.target.value }))} placeholder="2026-04-23T10:00:00Z" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Consent note
                <input value={createForm.consentNote} onChange={(event) => setCreateForm((current) => ({ ...current, consentNote: event.target.value }))} placeholder="Approved for pricing follow-up" />
              </label>
              <label>
                Visibility note
                <input value={createForm.visibilityNote} onChange={(event) => setCreateForm((current) => ({ ...current, visibilityNote: event.target.value }))} placeholder="Shared with the sales response team" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Source provider
                <input value={createForm.provenanceProvider} onChange={(event) => setCreateForm((current) => ({ ...current, provenanceProvider: event.target.value }))} placeholder="gmail" />
              </label>
              <label>
                Import reference
                <input value={createForm.provenanceImportReference} onChange={(event) => setCreateForm((current) => ({ ...current, provenanceImportReference: event.target.value }))} placeholder="crm-4471" />
              </label>
              <label>
                Imported at
                <input value={createForm.provenanceImportedAt} onChange={(event) => setCreateForm((current) => ({ ...current, provenanceImportedAt: event.target.value }))} placeholder="2026-04-23T09:30:00Z" />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Last verified at
                <input value={createForm.provenanceLastVerifiedAt} onChange={(event) => setCreateForm((current) => ({ ...current, provenanceLastVerifiedAt: event.target.value }))} placeholder="2026-04-23T10:15:00Z" />
              </label>
              <label>
                Provenance note
                <input value={createForm.provenanceNote} onChange={(event) => setCreateForm((current) => ({ ...current, provenanceNote: event.target.value }))} placeholder="Imported from the mailbox owner directory" />
              </label>
            </div>
            <details>
              <summary>Advanced metadata</summary>
              <label>
                Advanced metadata JSON
                <textarea rows={6} value={createForm.advancedMetadataJson} onChange={(event) => setCreateForm((current) => ({ ...current, advancedMetadataJson: event.target.value }))} />
              </label>
            </details>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate || !instanceId || !createForm.displayName.trim()}>
                {savingCreate ? "Creating contact" : "Create contact"}
              </button>
            </div>
          </form>
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit contact</h3>
              <p className="fg-muted">Keep the selected contact coherent across channel routes, provenance, consent, and linked work truth.</p>
            </div>
            <span className="fg-pill" data-tone={detail ? "neutral" : "warning"}>{detail ? detail.contact_id : "Select a contact"}</span>
          </div>

          {detail ? (
            <form className="fg-stack" onSubmit={handleUpdate}>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Contact ref
                  <input value={editForm.contactRef} onChange={(event) => setEditForm((current) => ({ ...current, contactRef: event.target.value }))} />
                </label>
                <label>
                  Source ID
                  <input value={editForm.sourceId} onChange={(event) => setEditForm((current) => ({ ...current, sourceId: event.target.value }))} />
                </label>
                <label>
                  Display name
                  <input value={editForm.displayName} onChange={(event) => setEditForm((current) => ({ ...current, displayName: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Organization
                  <input value={editForm.organization} onChange={(event) => setEditForm((current) => ({ ...current, organization: event.target.value }))} />
                </label>
                <label>
                  Title
                  <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} />
                </label>
                <label>
                  Status
                  <select value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as ContactStatus }))}>
                    {STATUS_OPTIONS.filter((option) => option !== "all").map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Primary email
                  <input value={editForm.primaryEmail} onChange={(event) => setEditForm((current) => ({ ...current, primaryEmail: event.target.value }))} />
                </label>
                <label>
                  Secondary email
                  <input value={editForm.secondaryEmail} onChange={(event) => setEditForm((current) => ({ ...current, secondaryEmail: event.target.value }))} />
                </label>
                <label>
                  Slack handle
                  <input value={editForm.slackHandle} onChange={(event) => setEditForm((current) => ({ ...current, slackHandle: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Primary phone
                  <input value={editForm.primaryPhone} onChange={(event) => setEditForm((current) => ({ ...current, primaryPhone: event.target.value }))} />
                </label>
                <label>
                  Secondary phone
                  <input value={editForm.secondaryPhone} onChange={(event) => setEditForm((current) => ({ ...current, secondaryPhone: event.target.value }))} />
                </label>
                <label>
                  Visibility scope
                  <select value={editForm.visibilityScope} onChange={(event) => setEditForm((current) => ({ ...current, visibilityScope: event.target.value as VisibilityScope }))}>
                    {VISIBILITY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Consent status
                  <input value={editForm.consentStatus} onChange={(event) => setEditForm((current) => ({ ...current, consentStatus: event.target.value }))} />
                </label>
                <label>
                  Consent captured at
                  <input value={editForm.consentCapturedAt} onChange={(event) => setEditForm((current) => ({ ...current, consentCapturedAt: event.target.value }))} />
                </label>
                <label>
                  Consent note
                  <input value={editForm.consentNote} onChange={(event) => setEditForm((current) => ({ ...current, consentNote: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Source provider
                  <input value={editForm.provenanceProvider} onChange={(event) => setEditForm((current) => ({ ...current, provenanceProvider: event.target.value }))} />
                </label>
                <label>
                  Import reference
                  <input value={editForm.provenanceImportReference} onChange={(event) => setEditForm((current) => ({ ...current, provenanceImportReference: event.target.value }))} />
                </label>
                <label>
                  Imported at
                  <input value={editForm.provenanceImportedAt} onChange={(event) => setEditForm((current) => ({ ...current, provenanceImportedAt: event.target.value }))} />
                </label>
              </div>
              <div className="fg-grid fg-grid-compact">
                <label>
                  Last verified at
                  <input value={editForm.provenanceLastVerifiedAt} onChange={(event) => setEditForm((current) => ({ ...current, provenanceLastVerifiedAt: event.target.value }))} />
                </label>
                <label>
                  Provenance note
                  <input value={editForm.provenanceNote} onChange={(event) => setEditForm((current) => ({ ...current, provenanceNote: event.target.value }))} />
                </label>
                <label>
                  Visibility note
                  <input value={editForm.visibilityNote} onChange={(event) => setEditForm((current) => ({ ...current, visibilityNote: event.target.value }))} />
                </label>
              </div>
              <details>
                <summary>Advanced metadata</summary>
                <label>
                  Advanced metadata JSON
                  <textarea rows={6} value={editForm.advancedMetadataJson} onChange={(event) => setEditForm((current) => ({ ...current, advancedMetadataJson: event.target.value }))} />
                </label>
              </details>
              <div className="fg-actions">
                <button type="submit" disabled={!canMutate || savingUpdate || !editForm.displayName.trim()}>
                  {savingUpdate ? "Saving contact" : "Save contact"}
                </button>
              </div>
            </form>
          ) : (
            <p className="fg-muted">Select a contact before attempting a mutation.</p>
          )}
        </article>
      </div>
    </section>
  );
}
