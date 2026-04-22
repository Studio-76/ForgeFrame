import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { loginAdmin, setAdminToken } from "../api/admin";
import { getPostLoginDestination } from "../app/authRouting";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await loginAdmin({ username, password });
      setAdminToken(result.access_token);
      setError("");
      navigate(getPostLoginDestination(result.user, searchParams.get("next")), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  };

  return (
    <section>
      <h2>Admin Login</h2>
      <p className="fg-muted">Sign in with an administrator account to access the protected control-plane modules.</p>
      <div className="fg-card" style={{ maxWidth: "36rem" }}>
        <form className="fg-stack" onSubmit={(event) => void onSubmit(event)}>
          <label>
            Username
            <input
              autoComplete="username"
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
          <button type="submit">Sign in</button>
          {error ? <p className="fg-danger">{error}</p> : null}
        </form>
      </div>
    </section>
  );
}
