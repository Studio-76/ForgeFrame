import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { PageIntro } from "../components/PageIntro";
import { SkillDetail, SkillForm, SkillList, useSkills } from "../features/skills";
import { buildInventoryPath } from "../features/skills/utils";

/**
 * Skills page — versioned skill registry with scope, provenance, activation,
 * usage telemetry, and full CRUD for registry entries.
 *
 * Uses the `useSkills()` hook for all state and handlers, delegating the UI
 * to `SkillList` (filter bar + registry table), `SkillDetail` (inspect/update/
 * activate/record), and `SkillForm` (create new entry).
 */
export function SkillsPage() {
  const skills = useSkills();

  if (!skills.sessionReady) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Skills"
          description="Restoring skill registry scope."
          question="Open skill inventory when session access resolves."
          links={[
            {
              label: "Command Center",
              to: CONTROL_PLANE_ROUTES.dashboard,
              description: "Return to dashboard while access resolves.",
            },
          ]}
          badges={[{ label: "Checking access", tone: "neutral" }]}
          note="Skills remain versioned and scoped."
        />
      </section>
    );
  }

  if (!skills.canRead) {
    return (
      <section className="fg-page">
        <PageIntro
          eyebrow="Work Interaction"
          title="Skills"
          description="Skill data is available to operators and admins."
          question="Use Learning until skill access is available."
          links={[
            {
              label: "Learning",
              to: CONTROL_PLANE_ROUTES.learning,
              description: "Review learning suggestions.",
            },
          ]}
          badges={[{ label: "Operator or admin required", tone: "warning" }]}
          note="No placeholder skill state is rendered without scoped access."
        />
      </section>
    );
  }

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Skills"
        description="Manage versioned skills with scope, provenance, activation, and usage telemetry."
        question="Select a skill to review version, activation, and recent outcomes."
        links={[
          {
            label: "Learning",
            to: buildInventoryPath(CONTROL_PLANE_ROUTES.learning, skills.instanceId),
            description: "Review learning events that can promote draft skills.",
          },
          {
            label: "Agents",
            to: buildInventoryPath(CONTROL_PLANE_ROUTES.agents, skills.instanceId),
            description: "Inspect agent inventory for agent-scoped skill activations.",
          },
          {
            label: "Knowledge Sources",
            to: buildInventoryPath(CONTROL_PLANE_ROUTES.knowledgeSources, skills.instanceId),
            description: "Inspect knowledge sources referenced by skill provenance.",
          },
        ]}
        badges={[
          {
            label: `${skills.skills.length} skill${skills.skills.length === 1 ? "" : "s"}`,
            tone: skills.skills.length > 0 ? "success" : "warning",
          },
          {
            label: skills.canMutate ? "Admin mutation enabled" : "Read only",
            tone: skills.canMutate ? "success" : "neutral",
          },
        ]}
        note="Skills are registry records, not plugins or provider targets."
      />

      {skills.error ? <p className="fg-danger">{skills.error}</p> : null}
      {skills.message ? <p>{skills.message}</p> : null}

      <div className="fg-grid">
        <SkillList
          instances={skills.instances}
          instanceId={skills.instanceId}
          skills={skills.skills}
          agents={skills.agents}
          statusFilter={skills.statusFilter}
          scopeFilter={skills.scopeFilter}
          listState={skills.listState}
          instancesState={skills.instancesState}
          detailState={skills.detailState}
          canMutate={skills.canMutate}
          updateRoute={skills.updateRoute}
        />

        <SkillDetail
          detail={skills.detail}
          agents={skills.agents}
          instanceId={skills.instanceId}
          canMutate={skills.canMutate}
          editForm={skills.editForm}
          setEditForm={skills.setEditForm}
          activationForm={skills.activationForm}
          setActivationForm={skills.setActivationForm}
          usageForm={skills.usageForm}
          setUsageForm={skills.setUsageForm}
          savingUpdate={skills.savingUpdate}
          savingActivate={skills.savingActivate}
          savingArchive={skills.savingArchive}
          savingUsage={skills.savingUsage}
          handleUpdate={skills.handleUpdate}
          handleActivate={skills.handleActivate}
          handleArchive={skills.handleArchive}
          handleUsage={skills.handleUsage}
        />
      </div>

      <SkillForm
        createForm={skills.createForm}
        setCreateForm={skills.setCreateForm}
        agents={skills.agents}
        instanceId={skills.instanceId}
        canMutate={skills.canMutate}
        savingCreate={skills.savingCreate}
        handleCreate={skills.handleCreate}
      />
    </section>
  );
}
