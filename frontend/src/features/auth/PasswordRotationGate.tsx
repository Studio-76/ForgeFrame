import { useState, type FormEvent } from "react";

import { fetchAdminSession, rotateOwnPassword, type AdminSessionUser } from "../../api/admin";

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
  if (draft.new_password === draft.current_password) {
    throw new Error("New password must differ from the current temporary password.");
  }
  if (draft.new_password !== draft.confirm_password) {
    throw new Error("New password confirmation does not match.");
  }
  return {
    current_password: draft.current_password,
    new_password: draft.new_password,
  };
}

function formatRotationError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("Current temporary password was rejected")) {
      return "Current temporary password was rejected. Re-enter it and try again.";
    }
    if (error.message.includes("must differ")) {
      return "New password must differ from the current temporary password.";
    }
    if (error.message.includes("at least 8")) {
      return "New password must be at least 8 characters.";
    }
  }
  return "Password rotation could not be completed. Verify the temporary password and try again.";
}

type PasswordRotationGateProps = {
  session: AdminSessionUser;
  onRotationComplete: (session: AdminSessionUser) => void;
};

export function PasswordRotationGate({ session, onRotationComplete }: PasswordRotationGateProps) {
  const [draft, setDraft] = useState<PasswordRotationDraft>(createEmptyPasswordRotationDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setBusy(true);
      setError("");
      const payload = buildPasswordRotationRequest(draft);
      setMessage("Rotating password and reopening the control plane...");
      const response = await rotateOwnPassword(payload);
      const unlockedSession: AdminSessionUser = {
        ...session,
        user_id: response.user.user_id,
        username: response.user.username,
        display_name: response.user.display_name,
        role: response.user.role,
        must_rotate_password: response.user.must_rotate_password,
      };
      let nextSession = unlockedSession;
      try {
        const refreshedSession = await fetchAdminSession();
        nextSession = refreshedSession.user;
      } catch {
        // The password change already succeeded; keep the unlocked session and continue.
      }
      setDraft(createEmptyPasswordRotationDraft());
      onRotationComplete(nextSession);
    } catch (err) {
      setMessage("");
      setError(formatRotationError(err));
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

      <article className="fg-subcard">
        <h3>Password requirements</h3>
        <ul className="fg-list">
          <li>Use at least 8 characters.</li>
          <li>Choose a password that differs from the current temporary password.</li>
          <li>Confirm the new password exactly before submitting.</li>
        </ul>
      </article>

      <form className="fg-stack fg-mt-sm" onSubmit={(event) => void onSubmit(event)}>
        <div className="fg-grid fg-grid-compact">
          <label className="fg-stack">
            <span className="fg-muted">Current temporary password</span>
            <input
              autoComplete="current-password"
              autoFocus
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

        {message ? <p className="fg-muted fg-mt-sm" aria-live="polite">{message}</p> : null}
        {error ? <p className="fg-danger fg-mt-sm" role="alert">{error}</p> : null}

        <div className="fg-actions fg-mt-sm">
          <button disabled={busy} type="submit">
            {busy ? "Rotating password..." : "Rotate and unlock control plane"}
          </button>
        </div>
      </form>
    </article>
  );
}
