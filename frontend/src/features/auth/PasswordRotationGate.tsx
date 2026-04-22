import { useState } from "react";

import { rotateOwnPassword, type AdminSessionUser } from "../../api/admin";

export type PasswordRotationDraft = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

export function createEmptyPasswordRotationDraft(): PasswordRotationDraft {
  return {
    current_password: "",
    new_password: "",
    confirm_password: "",
  };
}

export function buildPasswordRotationRequest(draft: PasswordRotationDraft) {
  if (!draft.current_password) {
    throw new Error("Current temporary password is required.");
  }
  if (draft.new_password.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }
  if (draft.new_password !== draft.confirm_password) {
    throw new Error("New password confirmation does not match.");
  }
  return {
    current_password: draft.current_password,
    new_password: draft.new_password,
  };
}

type PasswordRotationGateProps = {
  session: AdminSessionUser;
  onRotationComplete: () => void;
};

export function PasswordRotationGate({ session, onRotationComplete }: PasswordRotationGateProps) {
  const [draft, setDraft] = useState<PasswordRotationDraft>(createEmptyPasswordRotationDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const onSubmit = async () => {
    try {
      setBusy(true);
      setError("");
      const payload = buildPasswordRotationRequest(draft);
      setMessage("Rotating password and restoring the control plane...");
      await rotateOwnPassword(payload);
      setDraft(createEmptyPasswordRotationDraft());
      onRotationComplete();
    } catch (err) {
      setMessage("");
      setError(err instanceof Error ? err.message : "Password rotation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="fg-card" style={{ maxWidth: "44rem" }}>
      <div className="fg-panel-heading">
        <div>
          <h2>Password Rotation Required</h2>
          <p className="fg-muted">
            This session for {session.display_name} is restricted until the temporary password is replaced. Only self-rotation and
            logout remain available.
          </p>
        </div>
        <span className="fg-pill" data-tone="warning">
          restricted session
        </span>
      </div>

      <p className="fg-note">
        Enter the current temporary password, choose a new secret, and the normal control-plane routes will unlock after the
        rotation completes.
      </p>

      <div className="fg-grid fg-grid-compact fg-mt-sm">
        <label className="fg-stack">
          <span className="fg-muted">Current temporary password</span>
          <input
            autoComplete="current-password"
            placeholder="current temporary password"
            type="password"
            value={draft.current_password}
            onChange={(event) => setDraft((prev) => ({ ...prev, current_password: event.target.value }))}
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
            onChange={(event) => setDraft((prev) => ({ ...prev, new_password: event.target.value }))}
          />
        </label>

        <label className="fg-stack">
          <span className="fg-muted">Confirm new password</span>
          <input
            autoComplete="new-password"
            minLength={8}
            placeholder="confirm new password"
            type="password"
            value={draft.confirm_password}
            onChange={(event) => setDraft((prev) => ({ ...prev, confirm_password: event.target.value }))}
          />
        </label>
      </div>

      {message ? <p className="fg-muted fg-mt-sm">{message}</p> : null}
      {error ? <p className="fg-danger fg-mt-sm">{error}</p> : null}

      <div className="fg-actions fg-mt-sm">
        <button disabled={busy} type="button" onClick={() => void onSubmit()}>
          Rotate and unlock control plane
        </button>
      </div>
    </article>
  );
}
