/**
 * Master hook for the Contacts page.
 *
 * Manages session access, URL state, data fetching, form state,
 * all CRUD handlers, and the create-form visibility toggle.
 *
 * @packageDocumentation
 */

import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import {
  createContact,
  fetchContactDetail,
  fetchContacts,
  updateContact,
  type ContactDetail,
  type ContactStatus,
  type ContactSummary,
} from "../../api/domain/contacts";
import { fetchInstances } from "../../api/domain/instances";
import { useAppSession } from "../../app/session";
import {
  getWorkInteractionAccess,
  normalizeOptional,
  parseJsonObject,
  type LoadState,
} from "../../pages/workInteractionPageSupport";
import {
  DEFAULT_CREATE_FORM,
  DEFAULT_EDIT_FORM,
  type CreateContactForm,
  type EditContactForm,
  type ContactSummaryCounts,
} from "./types";
import { buildContactMetadata, computeSummaryCounts, splitContactMetadata } from "./utils";

/**
 * Return value of the `useContacts()` hook.
 */
export interface UseContactsReturn {
  session: ReturnType<typeof useAppSession>["session"];
  sessionReady: boolean;
  canRead: boolean;
  canMutate: boolean;
  instanceId: string;
  selectedContactId: string;
  statusFilter: string;
  instances: Array<{ instance_id: string; display_name: string }>;
  contacts: ContactSummary[];
  detail: ContactDetail | null;
  summaryCounts: ContactSummaryCounts;
  showCreateForm: boolean;
  instancesState: LoadState;
  listState: LoadState;
  detailState: LoadState;
  createForm: CreateContactForm;
  editForm: EditContactForm;
  savingCreate: boolean;
  savingUpdate: boolean;
  error: string;
  message: string;
  updateRoute: (mutate: (next: URLSearchParams) => void, replace?: boolean) => void;
  handleCreate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleUpdate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setCreateForm: React.Dispatch<React.SetStateAction<CreateContactForm>>;
  setEditForm: React.Dispatch<React.SetStateAction<EditContactForm>>;
  setShowCreateForm: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Master hook for the Contacts page.
 *
 * Manages session access, URL state, data fetching, form state,
 * all CRUD handlers, and the create-form visibility toggle.
 */
export function useContacts(): UseContactsReturn {
  const { session, sessionReady } = useAppSession();
  const { canRead, canMutate } = getWorkInteractionAccess(session, sessionReady);
  const [searchParams, setSearchParams] = useSearchParams();

  const instanceId = searchParams.get("instanceId")?.trim() ?? "";
  const selectedContactId = searchParams.get("contactId")?.trim() ?? "";
  const statusFilter = (searchParams.get("status")?.trim() as ContactStatus | "all" | "") || "all";

  const [instances, setInstances] = useState<Array<{ instance_id: string; display_name: string }>>([]);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [instancesState, setInstancesState] = useState<LoadState>("idle");
  const [listState, setListState] = useState<LoadState>("idle");
  const [detailState, setDetailState] = useState<LoadState>("idle");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateContactForm>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditContactForm>(DEFAULT_EDIT_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const updateRoute = (mutate: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    startTransition(() => setSearchParams(next, { replace }));
  };

  // Fetch instances
  useEffect(() => {
    if (!canRead) {
      setInstances([]);
      return;
    }

    let cancelled = false;
    setInstancesState("loading");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) return;
        setInstances(payload.instances);
        setInstancesState("success");
        if (!instanceId && payload.instances[0]?.instance_id) {
          updateRoute((next) => next.set("instanceId", payload.instances[0].instance_id), true);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setInstances([]);
        setInstancesState("error");
        setError(loadError instanceof Error ? loadError.message : "Contact instance scope could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId]);

  // Fetch contacts list
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
        if (cancelled) return;
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
        if (cancelled) return;
        setContacts([]);
        setDetail(null);
        setListState("error");
        setError(loadError instanceof Error ? loadError.message : "Contact inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedContactId, statusFilter]);

  // Fetch contact detail
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
        if (cancelled) return;
        setDetail(payload.contact);
        setDetailState("success");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setDetailState("error");
        setError(loadError instanceof Error ? loadError.message : "Contact detail could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [canRead, instanceId, refreshNonce, selectedContactId]);

  // Sync edit form when detail changes
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
    if (!canMutate || !instanceId) return;

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
      setShowCreateForm(false);
      updateRoute((next) => next.set("contactId", payload.contact.contact_id));
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
    if (!canMutate || !instanceId || !detail) return;

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

  const summaryCounts = computeSummaryCounts(contacts);

  return {
    session,
    sessionReady,
    canRead,
    canMutate,
    instanceId,
    selectedContactId,
    statusFilter,
    instances,
    contacts,
    detail,
    summaryCounts,
    showCreateForm,
    instancesState,
    listState,
    detailState,
    createForm,
    editForm,
    savingCreate,
    savingUpdate,
    error,
    message,
    updateRoute,
    handleCreate,
    handleUpdate,
    setCreateForm,
    setEditForm,
    setShowCreateForm,
  };
}
