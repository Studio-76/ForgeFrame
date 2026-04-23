import type { AdminPermissionKey, AdminRole, AdminSessionUser } from "../api/admin";

const ROLE_ORDER: Record<AdminRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
  owner: 3,
};

const LEGACY_INSTANCE_PERMISSIONS_BY_ROLE: Record<AdminRole, readonly AdminPermissionKey[]> = {
  owner: [
    "instance.read",
    "instance.write",
    "providers.read",
    "providers.write",
    "provider_targets.read",
    "provider_targets.write",
    "routing.read",
    "routing.write",
    "approvals.read",
    "approvals.decide",
    "execution.read",
    "execution.operate",
    "security.read",
    "security.write",
    "audit.read",
    "settings.read",
    "settings.write",
  ],
  admin: [
    "instance.read",
    "providers.read",
    "providers.write",
    "provider_targets.read",
    "provider_targets.write",
    "routing.read",
    "routing.write",
    "approvals.read",
    "approvals.decide",
    "execution.read",
    "execution.operate",
    "security.read",
    "security.write",
    "audit.read",
    "settings.read",
    "settings.write",
  ],
  operator: [
    "instance.read",
    "providers.read",
    "provider_targets.read",
    "routing.read",
    "approvals.read",
    "execution.read",
    "execution.operate",
    "security.read",
    "audit.read",
    "settings.read",
  ],
  viewer: ["instance.read", "audit.read", "settings.read"],
};

export function roleAllows(role: AdminRole | null | undefined, requiredRole: AdminRole): boolean {
  if (!role) {
    return false;
  }
  return ROLE_ORDER[role] >= ROLE_ORDER[requiredRole];
}

export function getScopedAdminInstanceId(
  session: AdminSessionUser | null,
  instanceId?: string | null,
): string | null {
  const explicitInstanceId = instanceId?.trim();
  if (explicitInstanceId) {
    return explicitInstanceId;
  }
  const activeInstanceId = session?.active_instance_id?.trim();
  return activeInstanceId || null;
}

function getLegacyPermissions(session: AdminSessionUser | null): readonly AdminPermissionKey[] {
  if (!session) {
    return [];
  }
  return LEGACY_INSTANCE_PERMISSIONS_BY_ROLE[session.role] ?? [];
}

export function getAdminInstancePermissions(
  session: AdminSessionUser | null,
  instanceId?: string | null,
): AdminPermissionKey[] {
  if (!session) {
    return [];
  }

  const scopedInstanceId = getScopedAdminInstanceId(session, instanceId);
  const explicitPermissions = scopedInstanceId
    ? session.instance_permissions?.[scopedInstanceId]
    : undefined;
  if (explicitPermissions && explicitPermissions.length > 0) {
    return explicitPermissions;
  }

  const activeInstancePermissions = session.active_instance_id
    ? session.instance_permissions?.[session.active_instance_id]
    : undefined;
  if (!scopedInstanceId && activeInstancePermissions && activeInstancePermissions.length > 0) {
    return activeInstancePermissions;
  }

  return [...getLegacyPermissions(session)];
}

export function sessionHasInstancePermission(
  session: AdminSessionUser | null,
  instanceId: string | null | undefined,
  permissionKey: AdminPermissionKey,
): boolean {
  return getAdminInstancePermissions(session, instanceId).includes(permissionKey);
}

export function sessionHasAnyInstancePermission(
  session: AdminSessionUser | null,
  permissionKey: AdminPermissionKey,
): boolean {
  if (!session) {
    return false;
  }

  const explicitPermissionSets = Object.values(session.instance_permissions ?? {});
  if (explicitPermissionSets.length > 0) {
    return explicitPermissionSets.some((permissions) => (permissions ?? []).includes(permissionKey));
  }

  return getLegacyPermissions(session).includes(permissionKey);
}

export function sessionHasScopedOrAnyInstancePermission(
  session: AdminSessionUser | null,
  instanceId: string | null | undefined,
  permissionKey: AdminPermissionKey,
): boolean {
  const scopedInstanceId = getScopedAdminInstanceId(session, instanceId);
  if (scopedInstanceId) {
    return sessionHasInstancePermission(session, scopedInstanceId, permissionKey);
  }
  return sessionHasAnyInstancePermission(session, permissionKey);
}

export function sessionCanMutateInstance(
  session: AdminSessionUser | null,
  instanceId: string | null | undefined,
  permissionKey: AdminPermissionKey,
): boolean {
  return Boolean(session) && session?.read_only !== true && sessionHasInstancePermission(session, instanceId, permissionKey);
}

export function sessionCanMutateScopedOrAnyInstance(
  session: AdminSessionUser | null,
  instanceId: string | null | undefined,
  permissionKey: AdminPermissionKey,
): boolean {
  return Boolean(session)
    && session?.read_only !== true
    && sessionHasScopedOrAnyInstancePermission(session, instanceId, permissionKey);
}
