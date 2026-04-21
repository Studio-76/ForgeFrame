import { useEffect, useState } from "react";

import {
  createAdminUser,
  fetchAdminSessions,
  fetchAdminUsers,
  fetchSecurityBootstrap,
  revokeAdminSession,
  rotateAdminPassword,
  rotateOwnPassword,
  type AdminSecuritySession,
  type AdminUser,
} from "../api/admin";

export function SecurityPage() {
  const [bootstrap, setBootstrap] = useState<Record<string, string | number | boolean> | null>(null);
  const [secretPosture, setSecretPosture] = useState<Array<Record<string, string | number | boolean>>>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sessions, setSessions] = useState<AdminSecuritySession[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createForm, setCreateForm] = useState({ username: "", display_name: "", role: "operator", password: "" });
  const [selfPassword, setSelfPassword] = useState({ current_password: "", new_password: "" });

  const load = async () => {
    try {
      const [bootstrapPayload, usersPayload, sessionsPayload] = await Promise.all([
        fetchSecurityBootstrap(),
        fetchAdminUsers(),
        fetchAdminSessions(),
      ]);
      setBootstrap(bootstrapPayload.bootstrap);
      setSecretPosture(bootstrapPayload.secret_posture);
      setUsers(usersPayload.users);
      setSessions(sessionsPayload.sessions);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Security loading failed.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async () => {
    await createAdminUser(createForm);
    setCreateForm({ username: "", display_name: "", role: "operator", password: "" });
    setMessage("Admin user created.");
    await load();
  };

  return (
    <section>
      <h2>Security & Admin</h2>
      <p className="fg-muted">Admin users, active sessions, password rotation and provider secret posture.</p>
      {error ? <p className="fg-danger">{error}</p> : null}
      {message ? <p>{message}</p> : null}

      {bootstrap ? (
        <article className="fg-card" style={{ marginBottom: "0.75rem" }}>
          <h3>Bootstrap Security Status</h3>
          <ul>
            {Object.entries(bootstrap).map(([key, value]) => (
              <li key={key}>
                {key}: {String(value)}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <article className="fg-card" style={{ marginBottom: "0.75rem" }}>
        <h3>Create Admin User</h3>
        <div className="fg-grid fg-grid-compact">
          <input placeholder="username" value={createForm.username} onChange={(event) => setCreateForm((prev) => ({ ...prev, username: event.target.value }))} />
          <input placeholder="display name" value={createForm.display_name} onChange={(event) => setCreateForm((prev) => ({ ...prev, display_name: event.target.value }))} />
          <select value={createForm.role} onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value }))}>
            <option value="admin">admin</option>
            <option value="operator">operator</option>
            <option value="viewer">viewer</option>
          </select>
          <input type="password" placeholder="initial password" value={createForm.password} onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))} />
          <button type="button" onClick={() => void onCreate()}>Create User</button>
        </div>
      </article>

      <article className="fg-card" style={{ marginBottom: "0.75rem" }}>
        <h3>Rotate Own Password</h3>
        <div className="fg-grid fg-grid-compact">
          <input type="password" placeholder="current password" value={selfPassword.current_password} onChange={(event) => setSelfPassword((prev) => ({ ...prev, current_password: event.target.value }))} />
          <input type="password" placeholder="new password" value={selfPassword.new_password} onChange={(event) => setSelfPassword((prev) => ({ ...prev, new_password: event.target.value }))} />
          <button
            type="button"
            onClick={() => void rotateOwnPassword(selfPassword)
              .then(() => {
                setMessage("Own password rotated.");
                setSelfPassword({ current_password: "", new_password: "" });
              })
              .catch((err: Error) => setError(err.message))}
          >
            Rotate Password
          </button>
        </div>
      </article>

      <div className="fg-grid" style={{ marginBottom: "0.75rem" }}>
        <article className="fg-card">
          <h3>Admin Users</h3>
          <ul>
            {users.map((user) => (
              <li key={user.user_id}>
                {user.username} · {user.display_name} · role={user.role} · status={user.status} · rotate={String(user.must_rotate_password)}
                <button type="button" style={{ marginLeft: "0.5rem" }} onClick={() => void rotateAdminPassword(user.user_id, { new_password: "ForgeGate-Reset-123", must_rotate_password: true }).then(load)}>
                  Reset Password
                </button>
              </li>
            ))}
          </ul>
        </article>
        <article className="fg-card">
          <h3>Active Sessions</h3>
          <ul>
            {sessions.map((session) => (
              <li key={session.session_id}>
                {session.username} · role={session.role} · active={String(session.active)} · last_used={session.last_used_at}
                {session.active ? (
                  <button type="button" style={{ marginLeft: "0.5rem" }} onClick={() => void revokeAdminSession(session.session_id).then(load)}>
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="fg-card">
        <h3>Provider Secret Posture</h3>
        <ul>
          {secretPosture.map((provider) => (
            <li key={String(provider.provider)}>
              {String(provider.provider)} · configured={String(provider.configured)} · auth={String(provider.auth_mode)} · rotation={String(provider.rotation_support)}
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
