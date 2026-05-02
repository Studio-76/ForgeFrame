import { useState, type FormEvent } from "react";

import { fetchAdminSession, rotateOwnPassword, type AdminSessionUser } from "../../api/domain";
import {
  type PasswordRotationDraft,
  createEmptyPasswordRotationDraft,
  buildPasswordRotationRequest,
} from "../auth/PasswordRotationGate";

/**
 * Props for the {@link PasswordRotationStep} component.
 */
export type PasswordRotationStepProps = {
  /** Current session user that needs password rotation. */
  session: AdminSessionUser;
  /** Called when the password rotation completes successfully. */
  onRotationComplete: (session: AdminSessionUser) => void;
};

/**
 * Format a rotation error into a user-facing message.
 */
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

/**
 * Password rotation form rendered inline inside the setup flow.
 *
 * Shown as step 1 when the session requires password rotation.
 * After successful rotation, the remaining setup steps become visible.
 */
export function PasswordRotationStep({
  session,
  onRotationComplete,
}: PasswordRotationStepProps) {
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
        /* The password change already succeeded; keep the unlocked session. */
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
    <article className="ff-setup-step-card ff-setup-step-current">
      <div className="ff-setup-step-header">
        <div className="ff-setup-step-number">1</div>
        <div className="ff-setup-step-info">
          <h3 className="ff-setup-step-title">Rotate password</h3>
          <p className="ff-setup-step-description">
            This session for {session.display_name} is restricted until the temporary password is
            replaced. After rotation, the full setup flow will become available.
          </p>
        </div>
        <span className="fg-pill" data-tone="warning">
          restricted session
        </span>
      </div>

      <article className="ff-setup-password-requirements">
        <h4>Password requirements</h4>
        <ul className="fg-list">
          <li>Use at least 8 characters.</li>
          <li>Choose a password that differs from the current temporary password.</li>
          <li>Confirm the new password exactly before submitting.</li>
        </ul>
      </article>

      <form className="ff-setup-password-form" onSubmit={(event) => void onSubmit(event)}>
        <div className="fg-grid fg-grid-compact">
          <label className="fg-stack">
            <span className="fg-muted">Current temporary password</span>
            <input
              autoComplete="current-password"
              autoFocus
              placeholder="current temporary password"
              type="password"
              value={draft.current_password}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, current_password: event.target.value }))
              }
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
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, new_password: event.target.value }))
              }
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
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, confirm_password: event.target.value }))
              }
            />
          </label>
        </div>

        {message ? (
          <p className="fg-muted fg-mt-sm" aria-live="polite">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="fg-danger fg-mt-sm" role="alert">
            {error}
          </p>
        ) : null}

        <div className="fg-actions fg-mt-sm">
          <button className="ff-setup-primary-action-button" disabled={busy} type="submit">
            {busy ? "Rotating password..." : "Rotate and unlock control plane"}
          </button>
        </div>
      </form>
    </article>
  );
}
