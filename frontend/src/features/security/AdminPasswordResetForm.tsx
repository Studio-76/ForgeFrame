import type { AdminPasswordRotationPayload, AdminUser } from "../../api/admin";

export type AdminPasswordResetDraft = {
  new_password: string;
  confirm_password: string;
};

export function createEmptyAdminPasswordResetDraft(): AdminPasswordResetDraft {
  return {
    new_password: "",
    confirm_password: "",
  };
}

export function buildAdminPasswordResetPayload(draft: AdminPasswordResetDraft): AdminPasswordRotationPayload {
  if (draft.new_password.length < 8) {
    throw new Error("Temporary password must be at least 8 characters.");
  }
  if (draft.new_password !== draft.confirm_password) {
    throw new Error("Password confirmation does not match.");
  }
  return {
    new_password: draft.new_password,
    must_rotate_password: true,
  };
}

type AdminPasswordResetFormProps = {
  user: AdminUser;
  draft: AdminPasswordResetDraft;
  busy: boolean;
  onChange: (field: keyof AdminPasswordResetDraft, value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function AdminPasswordResetForm({
  user,
  draft,
  busy,
  onChange,
  onCancel,
  onSubmit,
}: AdminPasswordResetFormProps) {
  const targetName = user.display_name || user.username;

  return (
    <div className="fg-subcard fg-mt-sm">
      <div className="fg-panel-heading">
        <div>
          <h4>Prepare temporary password handoff</h4>
          <p className="fg-muted">
            Enter a temporary secret for {targetName}. Share it through a trusted channel only. ForgeFrame will force a password
            change on first login.
          </p>
        </div>
        <span className="fg-pill" data-tone="warning">
          first login must rotate
        </span>
      </div>

      <div className="fg-grid fg-grid-compact">
        <label className="fg-stack">
          <span className="fg-muted">Temporary password</span>
          <input
            autoComplete="new-password"
            minLength={8}
            placeholder="temporary password"
            type="password"
            value={draft.new_password}
            onChange={(event) => onChange("new_password", event.target.value)}
          />
        </label>

        <label className="fg-stack">
          <span className="fg-muted">Confirm temporary password</span>
          <input
            autoComplete="new-password"
            minLength={8}
            placeholder="confirm temporary password"
            type="password"
            value={draft.confirm_password}
            onChange={(event) => onChange("confirm_password", event.target.value)}
          />
        </label>
      </div>

      <p className="fg-muted fg-mt-sm">
        This reset revokes the target admin&apos;s active sessions and keeps forced rotation enabled for the first successful sign-in.
      </p>

      <div className="fg-actions fg-mt-sm">
        <button disabled={busy} type="button" onClick={onSubmit}>
          Apply temporary password
        </button>
        <button disabled={busy} type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
