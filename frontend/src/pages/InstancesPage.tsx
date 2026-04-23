import { useEffect, useMemo, useState } from "react";

import {
  createInstance,
  fetchInstances,
  updateInstance,
  type InstanceRecord,
} from "../api/admin";
import { sessionCanMutateScopedOrAnyInstance } from "../app/adminAccess";
import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { useAppSession } from "../app/session";
import { PageIntro } from "../components/PageIntro";

type LoadState = "idle" | "loading" | "success" | "error";

const DEFAULT_CREATE_FORM = {
  instance_id: "",
  display_name: "",
  description: "",
  tenant_id: "",
  company_id: "",
  deployment_mode: "linux_host_native" as InstanceRecord["deployment_mode"],
  exposure_mode: "same_origin" as InstanceRecord["exposure_mode"],
};

export function InstancesPage() {
  const { session, sessionReady } = useAppSession();
  const canMutate = sessionCanMutateScopedOrAnyInstance(session, null, "instance.write");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [instances, setInstances] = useState<InstanceRecord[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setError("");

    void fetchInstances()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setInstances(payload.instances);
        setSelectedInstanceId((current) => current || payload.instances[0]?.instance_id || "");
        setLoadState("success");
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setInstances([]);
        setLoadState("error");
        setError(loadError instanceof Error ? loadError.message : "Instance inventory could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedInstance = useMemo(
    () => instances.find((item) => item.instance_id === selectedInstanceId) ?? null,
    [instances, selectedInstanceId],
  );
  const [editForm, setEditForm] = useState<Partial<InstanceRecord>>({});

  useEffect(() => {
    if (!selectedInstance) {
      setEditForm({});
      return;
    }
    setEditForm({
      display_name: selectedInstance.display_name,
      description: selectedInstance.description,
      status: selectedInstance.status,
      deployment_mode: selectedInstance.deployment_mode,
      exposure_mode: selectedInstance.exposure_mode,
      tenant_id: selectedInstance.tenant_id,
      company_id: selectedInstance.company_id,
    });
  }, [selectedInstance]);

  const refreshInstances = async (preferredInstanceId?: string) => {
    const payload = await fetchInstances();
    setInstances(payload.instances);
    setSelectedInstanceId(preferredInstanceId ?? payload.instances[0]?.instance_id ?? "");
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate) {
      return;
    }
    setSavingCreate(true);
    setError("");
    setMessage("");
    try {
      const payload = await createInstance({
        instance_id: createForm.instance_id || null,
        display_name: createForm.display_name,
        description: createForm.description,
        tenant_id: createForm.tenant_id || null,
        company_id: createForm.company_id || null,
        deployment_mode: createForm.deployment_mode,
        exposure_mode: createForm.exposure_mode,
      });
      setCreateForm(DEFAULT_CREATE_FORM);
      await refreshInstances(payload.instance.instance_id);
      setMessage(`Instance ${payload.instance.display_name} created.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Instance creation failed.");
    } finally {
      setSavingCreate(false);
    }
  };

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canMutate || !selectedInstance) {
      return;
    }
    setSavingUpdate(true);
    setError("");
    setMessage("");
    try {
      const payload = await updateInstance(selectedInstance.instance_id, {
        display_name: typeof editForm.display_name === "string" ? editForm.display_name : undefined,
        description: typeof editForm.description === "string" ? editForm.description : undefined,
        tenant_id: typeof editForm.tenant_id === "string" ? editForm.tenant_id : undefined,
        company_id: typeof editForm.company_id === "string" ? editForm.company_id : undefined,
        status: editForm.status,
        deployment_mode: editForm.deployment_mode,
        exposure_mode: editForm.exposure_mode,
      });
      await refreshInstances(payload.instance.instance_id);
      setMessage(`Instance ${payload.instance.display_name} updated.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Instance update failed.");
    } finally {
      setSavingUpdate(false);
    }
  };

  if (!sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Setup"
          title="Instances"
          description="ForgeFrame is loading the top-level instance inventory before exposing bindings and deployment posture."
          question="Which instance boundary owns the runtime truth you are about to inspect or mutate?"
          links={[
            { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Return to the dashboard while instance access is being restored." },
            { label: "Providers", to: CONTROL_PLANE_ROUTES.providers, description: "Review provider posture once the instance inventory is known." },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="The instance registry is the top-level product boundary. ForgeFrame waits for session truth before opening mutation controls."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Setup"
        title="Instances"
        description="Top-level instance registry for scope bindings, deployment posture, and the canonical control-plane boundary."
        question="Which instance owns this environment, and do its tenant and execution scopes still match the runtime truth?"
        links={[
          { label: "Instances", to: CONTROL_PLANE_ROUTES.instances, description: "Stay on the instance inventory and binding surface." },
          { label: "Command Center", to: CONTROL_PLANE_ROUTES.dashboard, description: "Open the dashboard once the target instance is confirmed." },
          { label: "Execution Review", to: CONTROL_PLANE_ROUTES.execution, description: "Inspect instance-scoped execution truth after choosing the correct instance." },
          { label: "Providers", to: CONTROL_PLANE_ROUTES.providers, description: "Check provider truth for the selected instance." },
          { label: "Harness", to: CONTROL_PLANE_ROUTES.harness, description: "Open dedicated harness proof and profile controls for the selected instance." },
        ]}
        badges={[
          { label: `${instances.length} instance${instances.length === 1 ? "" : "s"}`, tone: instances.length > 0 ? "success" : "warning" },
          { label: canMutate ? "Admin mutation enabled" : "Read only", tone: canMutate ? "success" : "neutral" },
        ]}
        note="This surface is the product boundary, not a cosmetic label editor. Tenant and execution scopes must resolve back to a real ForgeFrame instance."
      />

      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      <div className="fg-grid">
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Instance Inventory</h3>
              <p className="fg-muted">Every entry is a top-level ForgeFrame instance with its own tenant and execution scope bindings.</p>
            </div>
            <span className="fg-pill" data-tone={loadState === "success" ? "success" : loadState === "error" ? "danger" : "neutral"}>
              {loadState}
            </span>
          </div>
          {loadState === "loading" ? <p className="fg-muted">Loading instance inventory.</p> : null}
          {loadState === "success" && instances.length === 0 ? <p className="fg-muted">No instances are recorded.</p> : null}
          {instances.length > 0 ? (
            <div className="fg-stack">
              {instances.map((item) => (
                <button
                  key={item.instance_id}
                  type="button"
                  className={`fg-data-row${item.instance_id === selectedInstanceId ? " is-current" : ""}`}
                  onClick={() => setSelectedInstanceId(item.instance_id)}
                >
                  <div className="fg-panel-heading fg-data-row-heading">
                    <div className="fg-page-header">
                      <span className="fg-code">{item.instance_id}</span>
                      <strong>{item.display_name}</strong>
                    </div>
                    <div className="fg-actions">
                      <span className="fg-pill" data-tone={item.status === "active" ? "success" : "warning"}>{item.status}</span>
                      {item.is_default ? <span className="fg-pill" data-tone="neutral">default</span> : null}
                    </div>
                  </div>
                  <div className="fg-detail-grid">
                    <span className="fg-muted">tenant {item.tenant_id} · execution {item.company_id}</span>
                    <span className="fg-muted">{item.deployment_mode} · {item.exposure_mode}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </article>

        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Create Instance</h3>
              <p className="fg-muted">Create a new top-level instance boundary with explicit tenant and execution scope bindings.</p>
            </div>
            <span className="fg-pill" data-tone={canMutate ? "success" : "warning"}>{canMutate ? "Writable" : "Admin only"}</span>
          </div>
          <form className="fg-stack" onSubmit={handleCreate}>
            <label>
              Instance ID
              <input value={createForm.instance_id} onChange={(event) => setCreateForm((current) => ({ ...current, instance_id: event.target.value }))} placeholder="customer-prod" />
            </label>
            <label>
              Display name
              <input value={createForm.display_name} onChange={(event) => setCreateForm((current) => ({ ...current, display_name: event.target.value }))} placeholder="Customer Production" />
            </label>
            <label>
              Description
              <textarea rows={4} value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label>
              Tenant scope
              <input value={createForm.tenant_id} onChange={(event) => setCreateForm((current) => ({ ...current, tenant_id: event.target.value }))} placeholder="customer-prod" />
            </label>
            <label>
              Execution scope
              <input value={createForm.company_id} onChange={(event) => setCreateForm((current) => ({ ...current, company_id: event.target.value }))} placeholder="customer-prod" />
            </label>
            <label>
              Deployment mode
              <select value={createForm.deployment_mode} onChange={(event) => setCreateForm((current) => ({ ...current, deployment_mode: event.target.value as InstanceRecord["deployment_mode"] }))}>
                <option value="linux_host_native">linux_host_native</option>
                <option value="restricted_eval">restricted_eval</option>
                <option value="container_optional">container_optional</option>
              </select>
            </label>
            <label>
              Exposure mode
              <select value={createForm.exposure_mode} onChange={(event) => setCreateForm((current) => ({ ...current, exposure_mode: event.target.value as InstanceRecord["exposure_mode"] }))}>
                <option value="same_origin">same_origin</option>
                <option value="local_only">local_only</option>
                <option value="edge_admission">edge_admission</option>
              </select>
            </label>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingCreate}>
                {savingCreate ? "Creating instance" : "Create instance"}
              </button>
            </div>
          </form>
        </article>
      </div>

      {selectedInstance ? (
        <article className="fg-card">
          <div className="fg-panel-heading">
            <div>
              <h3>Edit Selected Instance</h3>
              <p className="fg-muted">Mutations must preserve a coherent instance boundary. Tenant and execution scopes cannot silently drift.</p>
            </div>
            <span className="fg-pill" data-tone="neutral">{selectedInstance.instance_id}</span>
          </div>
          <form className="fg-stack" onSubmit={handleUpdate}>
            <label>
              Display name
              <input value={typeof editForm.display_name === "string" ? editForm.display_name : ""} onChange={(event) => setEditForm((current) => ({ ...current, display_name: event.target.value }))} />
            </label>
            <label>
              Description
              <textarea rows={4} value={typeof editForm.description === "string" ? editForm.description : ""} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <div className="fg-grid fg-grid-compact">
              <label>
                Tenant scope
                <input value={typeof editForm.tenant_id === "string" ? editForm.tenant_id : ""} onChange={(event) => setEditForm((current) => ({ ...current, tenant_id: event.target.value }))} />
              </label>
              <label>
                Execution scope
                <input value={typeof editForm.company_id === "string" ? editForm.company_id : ""} onChange={(event) => setEditForm((current) => ({ ...current, company_id: event.target.value }))} />
              </label>
            </div>
            <div className="fg-grid fg-grid-compact">
              <label>
                Status
                <select value={editForm.status ?? "active"} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as InstanceRecord["status"] }))}>
                  <option value="active">active</option>
                  <option value="disabled">disabled</option>
                </select>
              </label>
              <label>
                Deployment mode
                <select value={editForm.deployment_mode ?? selectedInstance.deployment_mode} onChange={(event) => setEditForm((current) => ({ ...current, deployment_mode: event.target.value as InstanceRecord["deployment_mode"] }))}>
                  <option value="linux_host_native">linux_host_native</option>
                  <option value="restricted_eval">restricted_eval</option>
                  <option value="container_optional">container_optional</option>
                </select>
              </label>
              <label>
                Exposure mode
                <select value={editForm.exposure_mode ?? selectedInstance.exposure_mode} onChange={(event) => setEditForm((current) => ({ ...current, exposure_mode: event.target.value as InstanceRecord["exposure_mode"] }))}>
                  <option value="same_origin">same_origin</option>
                  <option value="local_only">local_only</option>
                  <option value="edge_admission">edge_admission</option>
                </select>
              </label>
            </div>
            <div className="fg-actions">
              <button type="submit" disabled={!canMutate || savingUpdate}>
                {savingUpdate ? "Saving instance" : "Save instance"}
              </button>
            </div>
          </form>
        </article>
      ) : null}
    </section>
  );
}
