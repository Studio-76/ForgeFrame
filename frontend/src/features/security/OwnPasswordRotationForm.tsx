export type OwnPasswordRotationDraft = {
  current_password: string;
  new_password: string;
};

export function createEmptyOwnPasswordRotationDraft(): OwnPasswordRotationDraft {
  return {
    current_password: "",
    new_password: "",
  };
}

export function buildOwnPasswordRotationPayload(draft: OwnPasswordRotationDraft) {
  if (!draft.current_password.trim()) {
    throw new Error("Current password is required.");
  }
  if (draft.new_password.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }

  return {
    current_password: draft.current_password,
    new_password: draft.new_password,
  };
}

type OwnPasswordRotationFormProps = {
  title: string;
  description: string;
  note: string;
  submitLabel: string;
  busy: boolean;
  draft: OwnPasswordRotationDraft;
  onChange: (field: keyof OwnPasswordRotationDraft, value: string) => void;
  onSubmit: () => void;
};

export function OwnPasswordRotationForm({
  title,
  description,
  note,
  submitLabel,
  busy,
  draft,
  onChange,
  onSubmit,
}: OwnPasswordRotationFormProps) {
  return (
    <article className="fg-card">
      <div className="fg-panel-heading">
        <div>
          <h3>{title}</h3>
          <p className="fg-muted">{description}</p>
        </div>
        <span className="fg-pill" data-tone="warning">
          password rotation
        </span>
      </div>
      <div className="fg-grid fg-grid-compact">
        <label className="fg-stack">
          <span className="fg-muted">Current password</span>
          <input
            autoComplete="current-password"
            placeholder="current password"
            type="password"
            value={draft.current_password}
            onChange={(event) => onChange("current_password", event.target.value)}
          />
        </label>
        <label className="fg-stack">
          <span className="fg-muted">New password</span>
          <input
            autoComplete="new-password"
            minLength={8}
            placeholder="new password"
            type="password"
            value={draft.new_password}
            onChange={(event) => onChange("new_password", event.target.value)}
          />
        </label>
      </div>
      <p className="fg-muted fg-mt-sm">{note}</p>
      <div className="fg-actions fg-mt-sm">
        <button disabled={busy} type="button" onClick={onSubmit}>
          {submitLabel}
        </button>
      </div>
    </article>
  );
}
