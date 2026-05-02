/**
 * Audit export form — a self-contained evidence package generator.
 *
 * Separated from the main audit history review to keep the export workflow
 * explicit. Operators fill in the scope, format, and filters, then generate
 * a downloadable package. Results appear inline with re-download support.
 *
 * @packageDocumentation
 */

import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  AdminApiError,
  generateAuditExport,
  type AuditExportFormat,
  type AuditExportResult,
  type AuditExportWindow,
  type AuditHistoryStatus,
  type AuditHistoryWindow,
} from "../../api/domain";
import { withQueryParams } from "../../app/tenantScope";
import type { AuditHistoryResponse } from "./types";
import { formatBytes, stringifyValue } from "./utils";

/** Props for AuditExportForm. */
export interface AuditExportFormProps {
  /** Instance ID for scoping. */
  instanceId: string | null;
  /** Company ID for scoping. */
  companyId: string | null;
  /** Selected instance display name. */
  instanceName: string | null;
  /** Whether the session can generate exports. */
  canGenerateExport: boolean;
  /** Audit history response for filter options. */
  history: AuditHistoryResponse | null;
  /** Default window. */
  defaultWindow: AuditHistoryWindow;
  /** Default action filter. */
  defaultAction: string | null;
  /** Default actor filter. */
  defaultActor: string | null;
  /** Default status filter. */
  defaultStatus: AuditHistoryStatus | null;
}

const EXPORT_DEFAULT_LIMIT = 250;
const HISTORY_WINDOWS: AuditHistoryWindow[] = ["24h", "7d", "30d", "all"];
const EXPORT_FORMATS: AuditExportFormat[] = ["json", "csv"];
const STATUS_OPTIONS: AuditHistoryStatus[] = ["ok", "warning", "failed"];

function optionLabel(value: string, options: Array<{ value: string; label: string }>) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function exportPackageLabel({
  instanceName,
  window,
  action,
  actor,
  status,
  includeRawDetails,
  limit,
}: {
  instanceName: string | null;
  window: AuditExportWindow;
  action: string;
  actor: string;
  status: AuditHistoryStatus | "";
  includeRawDetails: boolean;
  limit: number;
}) {
  return [
    instanceName ? `Instance: ${instanceName}` : "Instance: default scope",
    `Window: ${window}`,
    action.trim() ? `Action: ${action.trim()}` : null,
    actor.trim() ? `Actor: ${actor.trim()}` : null,
    status ? `Outcome: ${status}` : null,
    includeRawDetails ? "Raw details included" : "Raw details excluded",
    `Limit: ${limit}`,
  ].filter(Boolean).join(" \u00B7 ");
}

function exportFailureGuidance(error: unknown): { cause: string; correction: string } {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case "tenant_filter_required":
        return {
          cause: error.message,
          correction: "Pick an explicit instance or company scope before generating the evidence package.",
        };
      case "operator_role_required":
        return {
          cause: error.message,
          correction: "Open a standard operator or admin session. Viewer and impersonation sessions cannot generate exports.",
        };
      case "password_rotation_required":
        return {
          cause: error.message,
          correction: "Rotate the current password first, then restart the export from this page.",
        };
      default:
        return {
          cause: error.message,
          correction: "Review the selected scope and filters, then retry the export.",
        };
    }
  }
  return {
    cause: error instanceof Error ? error.message : "Audit export failed.",
    correction: "Review the selected scope and export contents, then retry. If the failure persists, inspect the linked audit event and backend logs.",
  };
}

type LoadState = "idle" | "loading" | "success" | "error";

/**
 * Self-contained audit export form.
 *
 * @param props - Component props.
 * @returns The export form.
 */
export function AuditExportForm({
  instanceId,
  companyId,
  instanceName,
  canGenerateExport,
  history,
  defaultWindow,
  defaultAction,
  defaultActor,
  defaultStatus,
}: AuditExportFormProps) {
  const [exportWindow, setExportWindow] = useState<AuditExportWindow>(defaultWindow);
  const [exportAction, setExportAction] = useState(defaultAction ?? "");
  const [exportActor, setExportActor] = useState(defaultActor ?? "");
  const [exportStatus, setExportStatus] = useState<AuditHistoryStatus | "">(defaultStatus ?? "");
  const [exportFormat, setExportFormat] = useState<AuditExportFormat>("json");
  const [includeRawDetails, setIncludeRawDetails] = useState(true);
  const [exportLimit, setExportLimit] = useState(String(EXPORT_DEFAULT_LIMIT));
  const [exportState, setExportState] = useState<LoadState>("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportCorrection, setExportCorrection] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<AuditExportResult | null>(null);
  const [lastExportSummary, setLastExportSummary] = useState<{
    window: AuditExportWindow;
    action: string;
    actor: string;
    status: AuditHistoryStatus | "";
    includeRawDetails: boolean;
    limit: number;
  } | null>(null);

  const exportLimitNumber = useMemo(() => {
    const parsed = Number(exportLimit);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : EXPORT_DEFAULT_LIMIT;
  }, [exportLimit]);

  const handleExport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canGenerateExport) {
      return;
    }
    setExportState("loading");
    setExportError(null);
    setExportCorrection(null);
    try {
      const payload = await generateAuditExport({
        format: exportFormat,
        window: exportWindow,
        action: exportAction.trim() ? exportAction.trim() : null,
        actor: exportActor.trim() ? exportActor.trim() : null,
        status: exportStatus || null,
        includeRawDetails,
        limit: exportLimitNumber,
      }, instanceId, undefined, companyId);
      setExportResult(payload);
      setLastExportSummary({
        window: exportWindow,
        action: exportAction,
        actor: exportActor,
        status: exportStatus,
        includeRawDetails,
        limit: exportLimitNumber,
      });
      setExportState("success");
    } catch (loadError) {
      const guidance = exportFailureGuidance(loadError);
      setExportState("error");
      setExportError(guidance.cause);
      setExportCorrection(guidance.correction);
    }
  };

  const downloadLatestExport = () => {
    if (!exportResult?.blob || typeof window === "undefined" || typeof URL.createObjectURL !== "function") {
      setExportState("error");
      setExportError("Latest export download is unsupported in this browser context.");
      return;
    }

    const objectUrl = URL.createObjectURL(exportResult.blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = exportResult.filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };

  const exportEventPath = exportResult
    ? withQueryParams("/logs#audit-history", {
        instanceId,
        companyId,
        auditWindow: "all",
        auditAction: "audit_export_generated",
        auditTargetType: "audit_export",
        auditTargetId: exportResult.exportId,
      })
    : "";

  return (
    <article className="fg-card" id="audit-export">
      <div className="fg-panel-heading">
        <div>
          <h3>Audit export</h3>
          <p className="fg-muted">
            Build a downloadable evidence package. History review stays separate and does not silently become an export.
          </p>
        </div>
      </div>

      <form className="fg-inline-form" onSubmit={(event) => void handleExport(event)}>
        <label>
          Instance
          <input value={instanceName ?? "Default instance path"} readOnly disabled />
        </label>
        <label>
          Window
          <select value={exportWindow} onChange={(event) => setExportWindow(event.target.value as AuditExportWindow)}>
            {HISTORY_WINDOWS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label>
          Actor
          <input
            value={exportActor}
            onChange={(event) => setExportActor(event.target.value)}
            placeholder="Optional actor filter"
          />
        </label>
        <label>
          Action
          <select value={exportAction} onChange={(event) => setExportAction(event.target.value)}>
            <option value="">Any action</option>
            {(history?.filters.available.actions ?? []).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Outcome
          <select value={exportStatus} onChange={(event) => setExportStatus(event.target.value as AuditHistoryStatus | "")}>
            <option value="">Any outcome</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{optionLabel(status, history?.filters.available.statuses ?? [])}</option>
            ))}
          </select>
        </label>
        <label>
          Format
          <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value as AuditExportFormat)}>
            {EXPORT_FORMATS.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
          </select>
        </label>
        <label>
          Include raw details
          <select value={includeRawDetails ? "include" : "exclude"} onChange={(event) => setIncludeRawDetails(event.target.value === "include")}>
            <option value="exclude">Exclude raw metadata</option>
            <option value="include">Include redacted raw metadata</option>
          </select>
        </label>
        <label>
          Limit
          <input
            type="number"
            min="1"
            value={exportLimit}
            onChange={(event) => setExportLimit(event.target.value)}
          />
        </label>
        <button type="submit" disabled={!canGenerateExport || exportState === "loading"}>
          {exportState === "loading" ? "Generating export" : `Generate ${exportFormat.toUpperCase()} export`}
        </button>
      </form>

      <p className="fg-muted fg-mt-sm">
        Package scope: {exportPackageLabel({
          instanceName,
          window: exportWindow,
          action: exportAction,
          actor: exportActor,
          status: exportStatus,
          includeRawDetails,
          limit: exportLimitNumber,
        })}
      </p>

      {exportState === "error" ? (
        <article className="fg-subcard fg-mt-md">
          <h4 className="fg-danger">Export could not be generated</h4>
          <p><strong>Cause:</strong> {exportError}</p>
          <p><strong>How to fix:</strong> {exportCorrection}</p>
        </article>
      ) : null}

      {exportResult ? (
        <article className="fg-subcard fg-mt-md">
          <h4>Latest exported package</h4>
          <ul className="fg-list">
            <li>Filename: {exportResult.filename}</li>
            <li>Artifact ID: {exportResult.exportId}</li>
            <li>Rows exported: {exportResult.rowCount}</li>
            <li>Package size: {formatBytes(exportResult.sizeBytes)}</li>
            <li>Generated at: {stringifyValue(exportResult.generatedAt)}</li>
            {lastExportSummary ? <li>Window: {lastExportSummary.window}</li> : null}
            {lastExportSummary?.action.trim() ? <li>Action filter: {lastExportSummary.action.trim()}</li> : null}
            {lastExportSummary?.actor.trim() ? <li>Actor filter: {lastExportSummary.actor.trim()}</li> : null}
            {lastExportSummary?.status ? <li>Outcome filter: {lastExportSummary.status}</li> : null}
            {lastExportSummary ? <li>{lastExportSummary.includeRawDetails ? "Redacted raw metadata included" : "Raw metadata excluded"}</li> : null}
          </ul>
          <div className="fg-actions fg-mt-sm">
            <Link className="fg-nav-link" to={exportEventPath}>Open export audit event</Link>
            <button className="fg-nav-link" type="button" onClick={downloadLatestExport}>
              Download latest export again
            </button>
          </div>
        </article>
      ) : null}
    </article>
  );
}
