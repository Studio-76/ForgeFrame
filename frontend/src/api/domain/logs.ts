/**
 * Logs domain API surface extracted from admin API.
 *
 * Note: AuditHistory types are not re-exported from this barrel to avoid
 * ambiguity with the domain/audit barrel. Import them from domain/audit instead.
 */
export {
  fetchLogs,
  type LogsResponse,
} from "../admin/logs";
