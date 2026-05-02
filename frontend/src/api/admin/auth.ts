/**
 * Admin authentication API functions and types.
 *
 * @packageDocumentation
 */

import {
  type AdminRole,
  type AdminPermissionKey,
  type AdminSessionUser,
  clearAdminToken as clearToken,
  fetchJson,
  getAdminToken as getToken,
  setAdminToken as setToken,
  AdminApiError,
} from "./_internal";

// ---------------------------------------------------------------------------
// Re-export shared types
// ---------------------------------------------------------------------------

export type { AdminRole, AdminPermissionKey, AdminSessionUser };
export { AdminApiError };

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

/**
 * Read the stored admin authentication token.
 * @returns The current admin token or an empty string.
 */
export function getAdminToken(): string {
  return getToken();
}

/**
 * Persist an admin authentication token to local storage.
 * @param token - The token to store.
 */
export function setAdminToken(token: string): void {
  setToken(token);
}

/**
 * Remove the admin authentication token from local storage.
 */
export function clearAdminToken(): void {
  clearToken();
}

// ---------------------------------------------------------------------------
// Authentication API functions
// ---------------------------------------------------------------------------

/**
 * Authenticate an admin user and receive an access token.
 * @param payload - Username and password credentials.
 * @returns Response containing access token, expiry, and user info.
 */
export function loginAdmin(payload: { username: string; password: string }) {
  return fetchJson<{ status: string; access_token: string; expires_at: string; user: AdminSessionUser }>("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch the current admin session user.
 * @returns Response containing the authenticated user.
 */
export function fetchAdminSession() {
  return fetchJson<{ status: string; user: AdminSessionUser }>("/admin/auth/me");
}

/**
 * Log out the current admin session.
 * @returns Response with logout confirmation.
 */
export function logoutAdmin() {
  return fetchJson<{ status: string; message: string }>("/admin/auth/logout", {
    method: "POST",
    body: "{}",
  });
}

/**
 * Rotate the current admin user's password.
 * @param payload - Current and new password.
 * @returns Response with the updated admin user.
 */
export function rotateOwnPassword(payload: { current_password: string; new_password: string }) {
  return fetchJson<{ status: string; user: AdminUser }>("/admin/auth/rotate-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Admin user record. */
export type AdminUser = {
  user_id: string;
  username: string;
  display_name: string;
  role: AdminRole;
  status: "active" | "disabled";
  must_rotate_password: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
  created_by?: string | null;
};
