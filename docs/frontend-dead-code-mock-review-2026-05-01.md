## Frontend dead-code and mock/fake implementation review

Date: 2026-05-01
Scope: `frontend/src` and `frontend/tests`

### Verdict

`REQUEST_CHANGES` — no critical runtime fake behavior found, but there is confirmed dead code and non-trivial fake/sample defaults that can leak into operator workflows.

### Findings

#### 1) [high] Unused domain API layer (dead code)

- **Summary:** `frontend/src/api/domain/*` is currently dead code.
- **Rationale:** It increases maintenance overhead and creates architectural drift (two API surfaces, one actually used).
- **Scope:**
  - `frontend/src/api/domain/index.ts`
  - `frontend/src/api/domain/providers.ts`
  - `frontend/src/api/domain/security.ts`
  - `frontend/src/api/domain/instances.ts`
  - `frontend/src/api/domain/conversations.ts`
  - `frontend/src/api/domain/routing.ts`
- **Evidence:** repository-wide search for `api/domain` imports returned no consumers in `frontend/src` or `frontend/tests`.
- **Confidence:** high.
- **Recommendation:** either (a) migrate page imports to these domain barrels now, or (b) remove the domain barrels until migration starts.
- **Regression risk:** low if removed with typecheck/tests/build validation.

#### 2) [medium] Fake sample payload prefilled for upgrade import

- **Summary:** `RecoveryPage` ships a large hardcoded success-looking upgrade payload in initial form state.
- **Rationale:** This can bias operators toward importing canned values and weakens trust that evidence is runtime-generated.
- **Scope:** `frontend/src/pages/RecoveryPage.tsx:159-161` (`DEFAULT_UPGRADE_IMPORT_FORM.payload_json`).
- **Evidence:** default JSON contains fixed release/version IDs and success markers (`"upgrade_result": "succeeded"`, `"no_loss_ok": true`, etc.).
- **Confidence:** high.
- **Recommendation:** initialize with `{}` plus inline required-field hints, or gate sample insertion behind an explicit “Insert example payload” action.
- **Regression risk:** low; this is UI-default behavior only.

#### 3) [medium] Fake/non-routable provider endpoint defaults embedded in creation drafts

- **Summary:** provider/harness draft defaults use `https://example.invalid/v1`.
- **Rationale:** While valid as a placeholder, this is a fake endpoint in mutable creation flows and can produce noisy failed requests if not replaced.
- **Scope:** `frontend/src/features/providers/useProvidersControlPlane.ts:81-103`, `:112-115`.
- **Evidence:** `INITIAL_PROVIDER_DRAFT.endpointBaseUrl` and `INITIAL_HARNESS_DRAFT.endpoint_base_url` both default to `https://example.invalid/v1`.
- **Confidence:** high.
- **Recommendation:** default to empty endpoint for classes that require explicit operator input and block submit until a non-example endpoint is provided.
- **Regression risk:** medium; form validation and tests may need updates.

### Non-findings (checked, not flagged)

- `vi.mock(...)` usage across `frontend/tests/*` is expected test-isolation behavior, not production fake implementation.
- Multiple `return null`/`return []` paths are predominantly guard clauses and defensive parsing fallbacks; not treated as dead code without unreachable-control-flow proof.
