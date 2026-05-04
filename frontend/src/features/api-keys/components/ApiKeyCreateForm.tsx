/**
 * ApiKeyCreateForm — key-issue form rendered inside the detail drawer.
 *
 * @packageDocumentation
 */

import type { GatewayAccount } from "../../../api/domain/accounts";
import type { RuntimeKeyRequestPathPolicy } from "../../../api/domain/runtime-keys";
import { REQUEST_PATH_OPTIONS, type RuntimeKeyIssueFormState } from "../types";

/**
 * Props for the ApiKeyCreateForm component.
 */
export type ApiKeyCreateFormProps = {
  /** Current form state. */
  form: RuntimeKeyIssueFormState;
  /** Called to update the form state. */
  onFormChange: (form: RuntimeKeyIssueFormState) => void;
  /** Available accounts for the account selector. */
  accounts: GatewayAccount[];
  /** Validation errors, if any. */
  errors: string[];
  /** Whether the form passes validation. */
  isValid: boolean;
};

/**
 * Create runtime key form — identity, scopes, and request-path policy.
 */
export function ApiKeyCreateForm({
  form,
  onFormChange,
  accounts,
  errors,
  isValid,
}: ApiKeyCreateFormProps) {
  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 ? (
        <ul className="text-danger text-sm space-y-1">
          {errors.map((item, index) => (
            <li key={`issue-key-error-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-meta text-muted">The key-issue form passed validation and is ready to submit.</p>
      )}

      {/* Identity and scope */}
      <section className="border border-border rounded-lg p-3">
        <h4 className="text-body font-semibold mb-2">Identity and scope</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-meta text-muted">Key label</span>
            <input
              className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
              value={form.label}
              onChange={(event) => onFormChange({ ...form, label: event.target.value })}
              placeholder="Primary runtime key"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-muted">Account</span>
            <select
              className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
              value={form.accountId}
              onChange={(event) => onFormChange({ ...form, accountId: event.target.value })}
            >
              <option value="">No account</option>
              {accounts.map((account) => (
                <option key={`issue-account-${account.account_id}`} value={account.account_id}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-meta text-muted">Runtime scopes</span>
            <textarea
              className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary font-mono"
              rows={5}
              value={form.scopes}
              onChange={(event) => onFormChange({ ...form, scopes: event.target.value })}
              placeholder={"models:read\nchat:write\nresponses:write"}
            />
          </label>
        </div>
      </section>

      {/* Request-path policy */}
      <section className="border border-border rounded-lg p-3">
        <h4 className="text-body font-semibold mb-2">Request-path policy</h4>
        <label className="flex flex-col gap-1 mb-3">
          <span className="text-meta text-muted">Allowed request paths</span>
          <textarea
            className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary font-mono"
            rows={6}
            value={form.allowed_request_paths}
            onChange={(event) => onFormChange({ ...form, allowed_request_paths: event.target.value })}
            placeholder={"smart_routing\nlocal_only"}
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-meta text-muted">Default request path</span>
            <select
              className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
              value={form.default_request_path}
              onChange={(event) => onFormChange({
                ...form,
                default_request_path: event.target.value as RuntimeKeyRequestPathPolicy["default_request_path"],
              })}
            >
              {REQUEST_PATH_OPTIONS.map((path) => (
                <option key={`issue-default-${path}`} value={path}>{path}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-muted">Pinned target key</span>
            <input
              className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
              value={form.pinned_target_key}
              onChange={(event) => onFormChange({ ...form, pinned_target_key: event.target.value })}
              placeholder="target_primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-muted">Local-only policy</span>
            <select
              className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary"
              value={form.local_only_policy}
              onChange={(event) => onFormChange({
                ...form,
                local_only_policy: event.target.value as RuntimeKeyRequestPathPolicy["local_only_policy"],
              })}
            >
              <option value="require_local_target">require_local_target</option>
              <option value="prefer_local">prefer_local</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 mt-3">
          <span className="text-meta text-muted">Review-required conditions</span>
          <textarea
            className="w-full rounded border border-border bg-surface-field px-3 py-2 text-body text-primary font-mono"
            rows={4}
            value={form.review_required_conditions}
            onChange={(event) => onFormChange({ ...form, review_required_conditions: event.target.value })}
            placeholder={"budget_exceeded\nmanual_approval"}
          />
        </label>
      </section>
    </div>
  );
}
