import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { loginAdmin, setAdminToken } from "../api/domain/auth";
import { getPostLoginDestination } from "../app/authRouting";
import sidebarBrandLogoUrl from "../assets/ff_logo_small-2-tp.png";

/**
 * Formats a login error into a human-readable message.
 * @param error - The raw error object from the login call.
 * @returns A user-facing error string.
 */
function formatLoginError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "Invalid admin credentials.") {
      return "Invalid admin credentials.";
    }
    if (error.message === "Too many failed login attempts. Try again later.") {
      return "Too many failed login attempts. Try again later.";
    }
  }
  return "Sign-in failed. Verify your credentials and try again.";
}

/**
 * ForgeFrame admin login page.
 *
 * Renders a branded card with the ForgeFrame logo, a secure login form
 * (username + password), and supplementary security notes. Used as the
 * primary authentication surface for the control plane.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setBusy(true);
      const result = await loginAdmin({ username, password });
      setAdminToken(result.access_token);
      setError("");
      navigate(getPostLoginDestination(result.user, searchParams.get("next")), {
        replace: true,
      });
    } catch (err) {
      setError(formatLoginError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ff-login-card" aria-labelledby="login-title">
      <div className="ff-login-brand">
        <img
          src={sidebarBrandLogoUrl}
          alt="ForgeFrame"
          className="ff-login-logo"
        />
      </div>

      <div className="ff-login-header">
        <h2 id="login-title">Admin Login</h2>
        <span className="ff-login-badge" data-tone="info">Protected</span>
      </div>

      <p className="ff-login-subtitle">
        Security boundary &mdash; admin credentials required.
      </p>

      <form
        className="ff-login-form"
        onSubmit={(event) => void onSubmit(event)}
      >
        <label className="ff-login-field">
          <span className="ff-login-label">Username</span>
          <input
            autoComplete="username"
            autoFocus
            name="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>

        <label className="ff-login-field">
          <span className="ff-login-label">Password</span>
          <span className="ff-login-password-wrap">
            <input
              autoComplete="current-password"
              name="password"
              required
              type={passwordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="fg-password-toggle"
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              onClick={() => setPasswordVisible((v) => !v)}
              tabIndex={-1}
            >
              {passwordVisible ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </span>
        </label>

        {error ? (
          <p className="fg-danger" role="alert">
            {error}
          </p>
        ) : null}

        <button className="ff-login-submit" type="submit" disabled={busy}>
          {busy ? (
            <>
              <span className="fg-spinner" /> Signing in&hellip;
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <ul className="ff-login-notes">
        <li>
          Temporary passwords trigger a forced rotation before the control
          plane opens.
        </li>
        <li>
          Signed-out users stay in the auth-only boundary until session is
          re-established.
        </li>
      </ul>
    </section>
  );
}
