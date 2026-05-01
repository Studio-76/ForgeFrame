import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { loginAdmin, setAdminToken } from "../api/admin";
import { getPostLoginDestination } from "../app/authRouting";

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
    <section className="fg-page" aria-labelledby="login-title">
      <article className="fg-card">
        <header className="fg-panel-heading">
          <span>
            <h2 id="login-title">Admin Login</h2>
            <p className="fg-muted">
              Security boundary — admin credentials required.
            </p>
          </span>
          <span className="fg-pill" data-tone="neutral">
            Protected
          </span>
        </header>

        <form className="fg-stack" onSubmit={(event) => void onSubmit(event)}>
          <label>
            Username
            <input
              autoComplete="username"
              autoFocus
              name="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            Password
            <span style={{ position: "relative", display: "block" }}>
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

          <button type="submit" disabled={busy}>
            {busy ? (
              <>
                <span className="fg-spinner" /> Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <ul className="fg-list">
          <li className="fg-muted">
            Temporary passwords trigger a forced rotation before the control
            plane opens.
          </li>
          <li className="fg-muted">
            Signed-out users stay in the auth-only boundary until session is
            re-established.
          </li>
        </ul>
      </article>
    </section>
  );
}
