/**
 * Account create/edit form drawer.
 *
 * @packageDocumentation
 */

import { type FormEvent } from "react";
import type { DrawerMode, AccountFormState } from "../types";
import { DRAWER_FORM_ID } from "../types";
import { DetailDrawer } from "../../../components/ui/DetailDrawer";

/** Props for {@link AccountFormDrawer}. */
export type AccountFormDrawerProps = {
  /** Current drawer mode. */
  mode: DrawerMode;
  /** Current form state. */
  form: AccountFormState;
  /** Called when the form state changes. */
  onFormChange: (form: AccountFormState) => void;
  /** Called when the drawer is closed. */
  onClose: () => void;
  /** Called when the form is submitted (create mode). */
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  /** Called when the form is submitted (edit mode). */
  onUpdate: (event: FormEvent<HTMLFormElement>) => void;
  /** Whether a save operation is in progress. */
  saving: boolean;
  /** Validation errors. */
  validationErrors: string[];
  /** Whether validation has passed. */
  validationPassed: boolean;
  /** Scope label for display. */
  scopeLabel: string;
  /** Instance ID for display. */
  instanceIdDisplay: string;
  /** Whether edit mode has a selected account. */
  hasSelectedAccount: boolean;
};

/**
 * Drawer with form for creating or editing a gateway account.
 */
export function AccountFormDrawer({
  mode,
  form,
  onFormChange,
  onClose,
  onCreate,
  onUpdate,
  saving,
  validationErrors,
  validationPassed,
  scopeLabel,
  instanceIdDisplay,
  hasSelectedAccount,
}: AccountFormDrawerProps) {
  const isCreate = mode === "create";

  return (
    <DetailDrawer
      open={mode !== "closed"}
      title={isCreate ? "Create Account" : "Edit Account"}
      description={
        isCreate
          ? "Create a runtime identity inside the current instance scope."
          : "Update label, provider bindings, and notes without mixing lifecycle with profile edits."
      }
      status={validationPassed ? "form ready" : "validation required"}
      statusTone={validationPassed ? "success" : "danger"}
      properties={[
        { label: "Scope", value: instanceIdDisplay },
        { label: "Lifecycle support", value: "active, suspended, disabled" },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form={DRAWER_FORM_ID}
            disabled={saving || !validationPassed || (!isCreate && !hasSelectedAccount)}
          >
            {isCreate ? "Create account" : "Save account changes"}
          </button>
        </div>
      }
      onClose={onClose}
    >
      <form
        id={DRAWER_FORM_ID}
        className="fg-stack"
        onSubmit={isCreate ? onCreate : onUpdate}
      >
        {validationErrors.length > 0 ? (
          <ul className="fg-list fg-danger">
            {validationErrors.map((item, index) => (
              <li key={`account-form-error-${index}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="fg-muted">The account form passed validation and is ready to submit.</p>
        )}

        <section className="fg-subcard">
          <h4>Identity</h4>
          <div className="fg-grid fg-grid-compact">
            <label>
              Account label
              <input
                value={form.label}
                onChange={(event) => onFormChange({ ...form, label: event.target.value })}
                placeholder="Customer Success Runtime"
              />
            </label>
            <label>
              Scope
              <input value={instanceIdDisplay} disabled />
            </label>
          </div>
        </section>

        <section className="fg-subcard">
          <h4>Provider bindings</h4>
          <label>
            Provider bindings
            <textarea
              rows={6}
              value={form.providerBindingsText}
              onChange={(event) => onFormChange({ ...form, providerBindingsText: event.target.value })}
              placeholder="openai_codex&#10;local_ollama"
            />
          </label>
          <p className="fg-muted">
            Enter one provider binding per line. Empty bindings stay allowed, but the account will surface as higher
            risk.
          </p>
        </section>

        <section className="fg-subcard">
          <h4>Operator notes</h4>
          <label>
            Notes
            <textarea
              rows={5}
              value={form.notes}
              onChange={(event) => onFormChange({ ...form, notes: event.target.value })}
              placeholder="Why this identity exists, who owns it, and when it should be reviewed."
            />
          </label>
        </section>
      </form>
    </DetailDrawer>
  );
}
