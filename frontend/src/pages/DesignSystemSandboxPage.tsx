/**
 * Design System Sandbox — visual reference and kitchen sink.
 *
 * This page documents every token, button variant, badge,
 * card, table, and empty state in the ForgeFrame design system.
 * It uses Tailwind utility classes throughout (bg-*, text-*,
 * border-*, p-*, rounded-*, font-*) to demonstrate the token
 * system in action.
 *
 * @remarks
 * This is NOT a production page. It exists as a living reference
 * for engineers building new UI surfaces. Do not route real
 * workflows through this component.
 */

import { type ReactNode } from "react";

/* ─── Section wrapper ───────────────────────────── */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="fg-card">
      <div className="fg-panel-heading">
        <h3 className="text-primary font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

/* ─── Token swatch ──────────────────────────────── */

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="block w-8 h-8 rounded-sm border border-border shrink-0"
        style={{ background: color }}
      />
      <div className="grid gap-0.25">
        <code className="text-muted text-meta font-mono">{label}</code>
        <code className="text-muted text-[0.7rem] font-mono opacity-70">{color}</code>
      </div>
    </div>
  );
}

/* ─── Status dot ────────────────────────────────── */

function StatusDot({ tone }: { tone: "success" | "warning" | "danger" | "info" | "neutral" }) {
  const colors: Record<string, string> = {
    success: "bg-success shadow-[0_0_0.65rem] shadow-success/60",
    warning: "bg-warning shadow-[0_0_0.65rem] shadow-warning/60",
    danger: "bg-danger shadow-[0_0_0.65rem] shadow-danger/60",
    info: "bg-info shadow-[0_0_0.65rem] shadow-info/60",
    neutral: "bg-muted",
  };
  return <span aria-hidden="true" className={`inline-block w-[0.45rem] h-[0.45rem] rounded-full ${colors[tone]}`} />;
}

/* ─── Page header ───────────────────────────────── */

function SandboxPageHeader() {
  return (
    <div className="fg-page-header">
      <p className="text-muted text-meta font-bold tracking-[0.08em] uppercase">
        Design System / Reference
      </p>
      <h1 className="text-[var(--fg-type-size-title)] font-bold text-primary">
        ForgeFrame UI Tokens
      </h1>
      <p className="text-muted max-w-[42rem] leading-relaxed">
        This sandbox documents every design token, button variant, badge tone, card density,
        and layout rule in the ForgeFrame system. Use it as a reference when building new
        pages — never invent ad-hoc colors, spacings, or radii.
      </p>
    </div>
  );
}

/* ─── Buttons section ───────────────────────────── */

function ButtonsSection() {
  return (
    <Section title="Buttons">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button className="ff-btn-primary">Primary</button>
          <button className="ff-btn-secondary">Secondary</button>
          <button className="ff-btn-tertiary">Tertiary</button>
          <button className="ff-btn-destructive">Destructive</button>
          <button className="ff-btn-nav">Nav Link</button>
        </div>
        <p className="text-muted text-meta">
          Default <code>&lt;button&gt;</code> is neutral. Add <code>.ff-btn-primary</code> for
          accent, <code>.ff-btn-secondary</code> for outline, <code>.ff-btn-tertiary</code> for
          ghost, <code>.ff-btn-destructive</code> for danger.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button className="ff-btn-primary ff-btn-sm">Primary Sm</button>
          <button className="ff-btn-secondary ff-btn-sm">Secondary Sm</button>
          <button className="ff-btn-destructive ff-btn-sm">Destructive Sm</button>
          <button className="ff-btn-primary ff-btn-lg">Primary Lg</button>
          <button className="ff-btn-secondary ff-btn-lg">Secondary Lg</button>
        </div>
        <p className="text-muted text-meta">
          Size modifiers: <code>.ff-btn-sm</code> (compact) and <code>.ff-btn-lg</code> (spacious).
          Default button padding is 0.4rem 0.75rem — intentionally compact.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button className="ff-btn-primary" disabled>Disabled</button>
          <button className="ff-btn-secondary" disabled>Disabled</button>
          <button className="ff-btn-destructive" disabled>Disabled</button>
        </div>
      </div>
    </Section>
  );
}

/* ─── Badges / Pills section ────────────────────── */

function BadgesSection() {
  return (
    <Section title="Badges &amp; Pills">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="fg-pill" data-tone="neutral">Neutral</span>
          <span className="fg-pill" data-tone="success">Success</span>
          <span className="fg-pill" data-tone="warning">Warning</span>
          <span className="fg-pill" data-tone="danger">Danger</span>
        </div>
        <p className="text-muted text-meta">
          Use <code>.fg-pill</code> with <code>data-tone</code> for status badges.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="ff-skills-status-led" data-state="success">Active</span>
          <span className="ff-skills-status-led" data-state="warning">Pending</span>
          <span className="ff-skills-status-led" data-state="idle">Offline</span>
        </div>
        <p className="text-muted text-meta">
          Status LEDs with <code>.ff-skills-status-led</code> and <code>data-state</code>.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="ff-skills-pill" data-tone="success">Live</span>
          <span className="ff-skills-pill" data-tone="warning">Degraded</span>
          <span className="ff-skills-pill" data-tone="danger">Down</span>
          <span className="ff-skills-pill" data-tone="neutral">Draft</span>
        </div>
        <p className="text-muted text-meta">
          Compact pills with <code>.ff-skills-pill</code> and <code>data-tone</code>.
        </p>
      </div>
    </Section>
  );
}

/* ─── Colors section ────────────────────────────── */

function ColorsSection() {
  return (
    <Section title="Color Tokens">
      <div className="grid gap-4">
        <p className="text-muted text-meta -mt-1">
          Surface levels &amp; text colors. Tailwind utilities: <code>bg-surface</code>,{" "}
          <code>text-primary</code>, <code>text-muted</code>, <code>border-border</code>.
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          <Swatch label="canvas" color="#0b101b" />
          <Swatch label="surface" color="#111827" />
          <Swatch label="surface-strong" color="#0f172a" />
          <Swatch label="surface-subtle" color="#1f2937" />
          <Swatch label="accent" color="#465fff" />
          <Swatch label="accent-soft" color="rgba(70, 95, 255, 0.14)" />
          <Swatch label="primary / text" color="#f8fafc" />
          <Swatch label="muted / text" color="#94a3b8" />
          <Swatch label="border" color="rgba(148, 163, 184, 0.18)" />
          <Swatch label="focus-ring" color="#84caff" />
        </div>

        <p className="text-muted text-meta mt-2">
          Status colors. Tailwind utilities: <code>bg-success</code>, <code>text-danger</code>,{" "}
          <code>border-warning</code>, etc.
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
          <Swatch label="success" color="#32d583" />
          <Swatch label="warning" color="#fdb022" />
          <Swatch label="danger" color="#f97066" />
          <Swatch label="info" color="#53b1fd" />
          <Swatch label="success-soft" color="rgba(50, 213, 131, 0.12)" />
          <Swatch label="warning-soft" color="rgba(253, 176, 34, 0.13)" />
          <Swatch label="danger-soft" color="rgba(249, 112, 102, 0.12)" />
          <Swatch label="info-soft" color="rgba(83, 177, 253, 0.13)" />
        </div>
      </div>
    </Section>
  );
}

/* ─── Cards section ─────────────────────────────── */

function CardsSection() {
  return (
    <Section title="Card &amp; Surface Patterns">
      <div className="grid gap-5">
        <div>
          <p className="text-muted text-meta mb-3">
            Standard card: <code>.fg-card</code> (1px border, 1rem padding, surface bg).
          </p>
          <div className="fg-card">
            <div className="fg-stack">
              <h4 className="text-primary font-semibold">Standard Card</h4>
              <p className="text-muted text-sm">
                The default card used for sections, settings panels, and detail views.
                Padding: 1rem. Radius: 0.5rem.
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-muted text-meta mb-3">
            Sub-card: <code>.fg-subcard</code> — inset, subtle bg.
          </p>
          <div className="fg-subcard">
            <div className="fg-stack">
              <h4 className="text-primary font-semibold text-sm">Sub Card</h4>
              <p className="text-muted text-sm">Nested inside a card for grouped content.</p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-muted text-meta mb-3">
            KPI card: <code>.fg-kpi</code> — strong bg, compact.
          </p>
          <div className="fg-grid-compact">
            <div className="fg-kpi">
              <span className="fg-detail-label">Active</span>
              <span className="fg-kpi-value text-success">42</span>
            </div>
            <div className="fg-kpi">
              <span className="fg-detail-label">Degraded</span>
              <span className="fg-kpi-value text-warning">3</span>
            </div>
            <div className="fg-kpi">
              <span className="fg-detail-label">Failed</span>
              <span className="fg-kpi-value text-danger">1</span>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ─── Table section ─────────────────────────────── */

function TableSection() {
  return (
    <Section title="Table Patterns">
      <div className="grid gap-4">
        <p className="text-muted text-meta -mt-1">
          Two table styles: <code>.fg-table</code> (inline) and{" "}
          <code>.ff-table-card</code> (card wrapper). Standard row height: ~2.5rem.
        </p>

        {/* ff-table-card layout */}
        <div className="ff-table-card">
          <div className="ff-table-card-header">
            <div>
              <h3 className="text-primary font-semibold text-sm">Active Skills</h3>
              <p className="text-muted text-meta">3 registered skills</p>
            </div>
            <button className="ff-btn-primary ff-btn-sm">Create</button>
          </div>
          <div className="ff-table-scroll">
            <table className="ff-data-table">
              <thead>
                <tr>
                  <th className="text-muted text-meta font-semibold uppercase tracking-[0.02em]">
                    Name
                  </th>
                  <th className="text-muted text-meta font-semibold uppercase tracking-[0.02em]">
                    Status
                  </th>
                  <th className="text-muted text-meta font-semibold uppercase tracking-[0.02em]">
                    Version
                  </th>
                  <th className="text-muted text-meta font-semibold uppercase tracking-[0.02em]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-primary font-medium">Code Review</td>
                  <td>
                    <span className="ff-skills-pill" data-tone="success">Active</span>
                  </td>
                  <td className="text-muted">v2.1.0</td>
                  <td>
                    <button className="ff-btn-tertiary ff-btn-sm">Manage</button>
                  </td>
                </tr>
                <tr>
                  <td className="text-primary font-medium">Deploy Gate</td>
                  <td>
                    <span className="ff-skills-pill" data-tone="warning">Degraded</span>
                  </td>
                  <td className="text-muted">v1.8.3</td>
                  <td>
                    <button className="ff-btn-tertiary ff-btn-sm">Manage</button>
                  </td>
                </tr>
                <tr>
                  <td className="text-primary font-medium">Audit Trail</td>
                  <td>
                    <span className="ff-skills-pill" data-tone="success">Active</span>
                  </td>
                  <td className="text-muted">v3.0.1</td>
                  <td>
                    <button className="ff-btn-tertiary ff-btn-sm">Manage</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Inline fg-table */}
        <p className="text-muted text-meta mt-2">
          Inline table: <code>.fg-table</code> — wraps in <code>.fg-table-wrap</code>.
        </p>
        <div className="fg-table-wrap">
          <table className="fg-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-primary font-mono text-meta">max_connections</td>
                <td className="text-primary">100</td>
                <td><span className="fg-pill" data-tone="success">OK</span></td>
              </tr>
              <tr>
                <td className="text-primary font-mono text-meta">timeout_ms</td>
                <td className="text-primary">30000</td>
                <td><span className="fg-pill" data-tone="warning">High</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

/* ─── Spacing section ───────────────────────────── */

function SpacingSection() {
  const spacings = [
    { name: "1", value: "0.25rem (4px)", px: 4 },
    { name: "2", value: "0.50rem (8px)", px: 8 },
    { name: "3", value: "0.75rem (12px)", px: 12 },
    { name: "4", value: "1.00rem (16px)", px: 16 },
    { name: "5", value: "1.50rem (24px)", px: 24 },
    { name: "6", value: "2.00rem (32px)", px: 32 },
    { name: "7", value: "2.50rem (40px)", px: 40 },
  ];
  return (
    <Section title="Spacing Scale">
      <div className="grid gap-3">
        <p className="text-muted text-meta -mt-1">
          Tailwind utilities: <code>p-3</code>, <code>gap-4</code>,{" "}
          <code>m-5</code> — all map to these ForgeFrame values.
        </p>
        {spacings.map((s) => (
          <div key={s.name} className="flex items-center gap-4">
            <code className="text-muted text-meta font-mono w-16 shrink-0">--fg-space-{s.name}</code>
            <span className="text-muted text-meta w-32 shrink-0">{s.value}</span>
            <div
              className="h-5 rounded-sm shrink-0"
              style={{
                width: s.px,
                background: "var(--fg-color-action-primary)",
              }}
            />
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ─── Empty state ──────────────────────────────── */

function EmptyStateDemo() {
  return (
    <Section title="Empty State Pattern">
      <div className="ff-skills-empty-content">
        <div className="ff-skills-tron-frame fg-card">
          <h3 className="text-primary font-bold text-lg">No items yet</h3>
          <p className="ff-skills-empty-desc">
            Skills let you define reusable capabilities — code review, deployment gates,
            audit checks — and attach them to your agent instances. Create your first
            skill to get started.
          </p>
          <div className="ff-skills-empty-actions">
            <button className="ff-btn-primary ff-btn-sm">Create Skill</button>
            <button className="ff-btn-secondary ff-btn-sm">Learn More</button>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ─── Layout section ────────────────────────────── */

function LayoutSection() {
  return (
    <Section title="Layout Rules">
      <div className="grid gap-3">
        <div className="flex items-center gap-3">
          <span className="text-muted text-meta font-mono w-48">Page max-width</span>
          <code className="text-primary font-mono text-meta">1600px</code>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted text-meta font-mono w-48">Shell max-width</span>
          <code className="text-primary font-mono text-meta">1440px</code>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted text-meta font-mono w-48">Section padding</span>
          <code className="text-primary font-mono text-meta">1.5rem (--fg-space-5)</code>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted text-meta font-mono w-48">Card padding</span>
          <code className="text-primary font-mono text-meta">1rem (--fg-space-4)</code>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted text-meta font-mono w-48">Table row height</span>
          <code className="text-primary font-mono text-meta">~2.5rem (0.8rem cell padding)</code>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted text-meta font-mono w-48">Sidebar width</span>
          <code className="text-primary font-mono text-meta">260px / collapsed 56px</code>
        </div>
      </div>
    </Section>
  );
}

/* ─── Page component ────────────────────────────── */

export function DesignSystemSandboxPage() {
  return (
    <div className="ff-main">
      <div className="fg-page">
        <SandboxPageHeader />
        <ButtonsSection />
        <BadgesSection />
        <ColorsSection />
        <CardsSection />
        <TableSection />
        <SpacingSection />
        <EmptyStateDemo />
        <LayoutSection />
      </div>
    </div>
  );
}
