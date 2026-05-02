import { CONTROL_PLANE_ROUTES } from "../app/navigation";
import { PageIntro } from "../components/PageIntro";
import {
  CreateSkillPanel,
  EmptyState,
  SkillDetailPanel,
  SkillFilters,
  SkillsSummaryHero,
  SkillTable,
  useSkills,
} from "../features/skills";
import { buildInventoryPath } from "../features/skills/utils";

/**
 * Skills page — redesigned skill lifecycle management surface.
 *
 * Shows a top-level summary hero with KPIs, then either an empty state
 * or the skill registry table + detail panel. The create form is hidden
 * until the operator clicks "Create skill".
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

  const summaryCounts = skills.summaryCounts;
  const hasSkills = summaryCounts.total > 0;
  const showCreate = skills.showCreateForm;
  const selectedSkillId = skills.skillId;

  return (
    <section className="fg-page">
      <PageIntro
        eyebrow="Work Interaction"
        title="Skills"
        description="Manage versioned skills with scope, provenance, activation, and usage telemetry."
        question="Select a skill to review its lifecycle state and take action."
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
            label: skills.canMutate ? "Admin mutation enabled" : "Read only",
            tone: skills.canMutate ? "success" : "neutral",
          },
        ]}
        note="Skills are registry records, not plugins or provider targets."
      />

      {/* ── Summary hero ── */}
      <SkillsSummaryHero
        totalSkills={summaryCounts.total}
        draftCount={summaryCounts.draft}
        activeCount={summaryCounts.active}
        reviewCount={summaryCounts.review}
        attentionCount={summaryCounts.attention}
        archivedCount={summaryCounts.archived}
        canMutate={skills.canMutate}
        hasInstance={Boolean(skills.instanceId)}
        loading={skills.listState === "loading"}
        onCreateSkill={() => skills.setShowCreateForm(true)}
      />

      {/* ── Error / Message display ── */}
      {skills.error ? <p className="fg-danger">{skills.error}</p> : null}
      {skills.message ? <p>{skills.message}</p> : null}

      {/* ── Create form mode ── */}
      {showCreate ? (
        <CreateSkillPanel
          createForm={skills.createForm}
          setCreateForm={skills.setCreateForm}
          agents={skills.agents}
          canMutate={skills.canMutate}
          savingCreate={skills.savingCreate}
          handleCreate={skills.handleCreate}
          onCancel={() => skills.setShowCreateForm(false)}
        />
      ) : !hasSkills && skills.listState !== "loading" ? (
        /* ── Empty state ── */
        <EmptyState
          canMutate={skills.canMutate}
          hasInstance={Boolean(skills.instanceId)}
          instanceId={skills.instanceId}
          onCreateSkill={() => skills.setShowCreateForm(true)}
        />
      ) : (
        /* ── Registry browse mode ── */
        <>
          <SkillFilters
            instanceId={skills.instanceId}
            statusFilter={skills.statusFilter}
            scopeFilter={skills.scopeFilter}
            activeOnly={skills.activeOnly}
            needsReview={skills.needsReview}
            updateRoute={skills.updateRoute}
          />
          <div className="fg-grid ff-skills-browse-layout">
            <SkillTable
              skills={skills.skills}
              selectedSkillId={selectedSkillId}
              listState={skills.listState}
              updateRoute={skills.updateRoute}
            />
            <SkillDetailPanel
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
        </>
      )}
    </section>
  );
}
