import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchAuthBootstrap, loginAdmin, setAdminToken } from "../api/admin";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("forgegate-admin");
  const [error, setError] = useState("");
  const [bootstrap, setBootstrap] = useState<Record<string, string | boolean> | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const payload = await fetchAuthBootstrap();
        if (!mounted) {
          return;
        }
        setBootstrap(payload.bootstrap);
      } catch {
        if (!mounted) {
          return;
        }
        setBootstrap(null);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async () => {
    try {
      const result = await loginAdmin({ username, password });
      setAdminToken(result.access_token);
      setError("");
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    }
  };

  return (
    <section>
      <h2>Admin Login</h2>
      <p className="fg-muted">Sign in to access the protected control-plane modules.</p>
      <div className="fg-card" style={{ maxWidth: "36rem" }}>
        <div className="fg-stack">
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="button" onClick={() => void onSubmit()}>Login</button>
          {error ? <p className="fg-danger">{error}</p> : null}
        </div>
      </div>
      {bootstrap ? (
        <article className="fg-card" style={{ marginTop: "1rem" }}>
          <h3>Bootstrap Status</h3>
          <ul>
            {Object.entries(bootstrap).map(([key, value]) => (
              <li key={key}>
                {key}: {String(value)}
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}
