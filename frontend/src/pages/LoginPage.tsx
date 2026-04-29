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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setBusy(true);
      const result = await loginAdmin({ username, password });
      setAdminToken(result.access_token);
      setError("");
      navigate(getPostLoginDestination(result.user, searchParams.get("next")), { replace: true });
    } catch (err) {
      setError(formatLoginError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="fg-page" aria-labelledby="login-title">
      <article className="fg-card">
        <div className="fg-panel-heading">
          <div>
            <p className="fg-muted">Security boundary</p>
            <h2 id="login-title">Admin Login</h2>
            <p className="fg-muted">Sign in with an administrator account to open the protected control-plane modules. Error feedback stays intentionally minimal and never discloses bootstrap secrets or account existence.</p>
          </div>
          <span className="fg-pill" data-tone="neutral">Protected</span>
        </div>

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
            <input
              autoComplete="current-password"
              name="password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <p className="fg-danger" role="alert">{error}</p> : null}

          <div className="fg-actions">
            <button type="submit" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>

        <ul className="fg-list fg-muted">
          <li>Temporary passwords trigger a forced password-rotation flow before the full control plane opens.</li>
          <li>Signed-out users stay inside the auth-only boundary until the admin session is established.</li>
        </ul>
      </article>
    </section>
  );
}
