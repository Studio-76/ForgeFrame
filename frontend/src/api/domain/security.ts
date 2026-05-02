/**
 * Security domain API surface extracted from admin API.
 */
export {
  createAdminUser,
  deleteAdminUserMembership,
  fetchAdminUsers,
  fetchProviderSecretPosture,
  fetchSecurityBootstrap,
  updateAdminUser,
  type SecurityBlocker,
  type SecurityBootstrapResponse,
  type SecurityBootstrapStatus,
  type SecurityCredentialPolicy,
  type SecurityRotationEvent,
  type SecuritySecretPosture,
} from "../admin/security";
