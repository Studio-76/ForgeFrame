import { Button } from "../../components/ui/Button";
import { IncidentResponsePage } from "../../components/page-templates/IncidentResponsePage";

/**
 * Demo page showcasing the IncidentResponsePage template.
 *
 * Demonstrates a health monitoring page with a degraded recommendation,
 * incident summary, and diagnostics section.
 */
export function DemoIncidentResponsePage() {
  return (
    <IncidentResponsePage
      eyebrow="Runtime"
      title="Health Status"
      description="System health and active incident overview"
      degradedAction={{
        message: "3 services degraded — review the incidents below for details.",
        action: <Button variant="primary">Run diagnostics</Button>,
      }}
      summaryItems={[
        { key: "active", label: "Active incidents", value: 3, tone: "danger" },
        { key: "blocked", label: "Blocked executions", value: 2, tone: "warning" },
        { key: "degraded", label: "Degraded services", value: 3, tone: "warning" },
        { key: "resolved", label: "Resolved (24h)", value: 7 },
      ]}
      diagnostics={
        <pre className="text-meta text-muted font-mono text-xs">
          {JSON.stringify(
            {
              lastHealthCheck: "2026-05-04T10:30:00Z",
              services: [
                { name: "api-gateway", status: "healthy" },
                { name: "provider-proxy", status: "degraded", error: "timeout" },
              ],
              uptime: "99.2%",
            },
            null,
            2,
          )}
        </pre>
      }
    >
      <div className="flex flex-col gap-2">
        {[
          {
            id: "INC-001",
            severity: "critical",
            title: "Provider proxy timeout",
            time: "2m ago",
            status: "active",
          },
          {
            id: "INC-002",
            severity: "high",
            title: "Rate limit exceeded for OpenAI",
            time: "15m ago",
            status: "active",
          },
          {
            id: "INC-003",
            severity: "medium",
            title: "Certificate expiring in 7 days",
            time: "1h ago",
            status: "acknowledged",
          },
        ].map((inc) => (
          <div
            key={inc.id}
            className="flex items-start gap-3 p-3 rounded-md border border-border"
          >
            <span
              className={`flex-shrink-0 w-2 h-2 mt-1.5 rounded-full ${
                inc.severity === "critical"
                  ? "bg-danger"
                  : inc.severity === "high"
                    ? "bg-warning"
                    : "bg-info"
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-body text-primary font-medium">{inc.title}</span>
              </div>
              <p className="text-meta text-muted mt-0.5">{inc.id}</p>
            </div>
            <span className="text-meta text-muted whitespace-nowrap">{inc.time}</span>
          </div>
        ))}
      </div>
    </IncidentResponsePage>
  );
}
