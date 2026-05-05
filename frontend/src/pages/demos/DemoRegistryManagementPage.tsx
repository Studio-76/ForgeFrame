import { useState } from "react";

import { RegistryManagementPage } from "../../components/page-templates/RegistryManagementPage";

/**
 * Demo page showcasing the RegistryManagementPage template.
 *
 * Demonstrates a provider targets registry with search,
 * summary stats, an empty detail hint, and diagnostics section.
 */
export function DemoRegistryManagementPage() {
  const [search, setSearch] = useState("");

  return (
    <RegistryManagementPage
      eyebrow="Setup"
      title="Provider Targets"
      description="Active execution targets for routing"
      scope={{ label: "prod-instance", onChange: () => {} }}
      summaryItems={[
        { key: "total", label: "Total", value: 12 },
        { key: "active", label: "Active", value: 8, tone: "success" },
        { key: "degraded", label: "Degraded", value: 1, tone: "warning" },
        { key: "offline", label: "Offline", value: 0 },
      ]}
      search={{ value: search, onChange: setSearch, placeholder: "Search targets..." }}
      actions={[
        { label: "Add target", kind: "primary", intent: "configure", onClick: () => {} },
      ]}
      emptyDetailHint="Select a target from the table to inspect its configuration."
      diagnostics={
        <pre className="text-meta text-muted font-mono text-xs">
          {JSON.stringify(
            {
              targetsTotal: 12,
              onlineCount: 8,
              lastSync: "2026-05-04T10:30:00Z",
              version: "2.1.0",
            },
            null,
            2,
          )}
        </pre>
      }
    >
      <table className="w-full text-body">
        <thead>
          <tr className="border-b border-border text-meta text-muted text-left">
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Provider</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 font-medium">Priority</th>
          </tr>
        </thead>
        <tbody>
          {[
            { name: "openai-prod", provider: "OpenAI", status: "Active", priority: 1 },
            { name: "anthropic-fallback", provider: "Anthropic", status: "Active", priority: 2 },
            { name: "google-ml", provider: "Google AI", status: "Degraded", priority: 3 },
            { name: "cohere-staging", provider: "Cohere", status: "Active", priority: 4 },
          ].map((row) => (
            <tr key={row.name} className="border-b border-border last:border-0">
              <td className="py-2 pr-4 text-primary font-medium">{row.name}</td>
              <td className="py-2 pr-4 text-muted">{row.provider}</td>
              <td className="py-2 pr-4">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-meta font-medium ${
                    row.status === "Active"
                      ? "bg-success/15 text-success"
                      : row.status === "Degraded"
                        ? "bg-warning/15 text-warning"
                        : "bg-surface-subtle text-muted"
                  }`}
                >
                  {row.status}
                </span>
              </td>
              <td className="py-2 text-muted">{row.priority}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </RegistryManagementPage>
  );
}
