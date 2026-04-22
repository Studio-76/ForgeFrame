# ForgeGate Heartbeat

Run this checklist on every Paperclip heartbeat in this repository.

## 1. Wake Context

- Read the issue objective, acceptance criteria, and newest comment first.
- If the wake is comment-driven, acknowledge the latest comment and explain how it changes the next action before broad repo exploration.
- Confirm whether the harness already checked out the issue workspace. Do not re-checkout the same issue unless you are intentionally switching tasks.

## 2. Workspace Safety

- Confirm the effective workspace path and branch.
- Inspect `git status --short` before editing so you do not trample unrelated work.
- Keep the canonical local remote on `git@github-forgegate:DaCHRIS/forgegate.git`.
- Assume `/opt/forgegate` may contain shared in-flight work; avoid destructive commands.

## 3. Scope The Work

- Identify the smallest code/doc/test surface that satisfies the acceptance criteria.
- Split parallel or specialist work into child issues instead of holding it locally.
- If the work needs a missing specialist, hire through the approved Paperclip flow before execution stalls.
- If a ForgeGate issue reaches `done` and touched shipped code, operator workflows, or release scripts, create or request an audit follow-up for the Auditor before treating the work as fully closed.

## 4. Execute

- Make concrete progress in the same heartbeat when the issue is actionable.
- Use repo-native scripts before inventing new workflows.
- Keep changes reversible and narrow unless the issue explicitly calls for a larger refactor.

## 5. Verify

- Run the narrowest relevant verification first.
- Escalate to broader checks when the change affects cross-cutting behavior, storage, auth, governance, or compose flows.
- Record any verification you could not run and why.

## 6. Communicate

- Update the Paperclip issue before exit.
- Every durable update should include:
  - objective
  - owner
  - acceptance criteria impact
  - blocker, if any
  - next action
- Route audit findings directly to the responsible specialist when ownership is clear; escalate to the CTO only when the issue crosses domains or ownership is ambiguous.
- If blocked, move the issue to `blocked` and name the unblock owner/action explicitly.

## 7. Repo Hygiene

- Keep `reference/` non-production.
- Do not commit secrets, credentials, or machine-specific state.
- Update root docs when execution rules, access paths, or operator workflows change.
