import { Button } from "../../components/ui/Button";
import { SettingsManagementPage } from "../../components/page-templates/SettingsManagementPage";

/**
 * Demo page showcasing the SettingsManagementPage template.
 *
 * Demonstrates a system settings page with grouped settings,
 * a selected detail panel, and diagnostics section.
 */
export function DemoSettingsManagementPage() {
  return (
    <SettingsManagementPage
      title="System Settings"
      description="Environment-level configuration and defaults"
      searchControl={
        <input
          type="text"
          className="w-full max-w-sm px-3 py-2 rounded-md border border-border bg-surface text-primary text-body"
          placeholder="Search settings..."
        />
      }
      selectedGroupContent={
        <div className="fg-card p-4">
          <h3 className="text-card text-primary font-semibold mb-3">Provider Settings</h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <span className="text-body text-primary">Default provider</span>
                <p className="text-meta text-muted">Primary AI provider for new executions</p>
              </div>
              <select className="px-3 py-1.5 rounded-md border border-border bg-surface text-body text-primary">
                <option>OpenAI</option>
                <option>Anthropic</option>
              </select>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <span className="text-body text-primary">Request timeout</span>
                <p className="text-meta text-muted">Maximum wait time for provider responses</p>
              </div>
              <select className="px-3 py-1.5 rounded-md border border-border bg-surface text-body text-primary">
                <option>30s</option>
                <option>60s</option>
                <option>120s</option>
              </select>
            </div>
            <div className="flex justify-end mt-2">
              <Button variant="primary">Save changes</Button>
            </div>
          </div>
        </div>
      }
      hasSelection={true}
      diagnostics={
        <pre className="text-meta text-muted font-mono text-xs">
          {JSON.stringify(
            {
              configVersion: "1.2.0",
              defaultProvider: "openai",
              timeout: 30,
              logLevel: "info",
              featureFlags: { betaRouting: false, newUI: true },
            },
            null,
            2,
          )}
        </pre>
      }
    >
      <div className="flex flex-col gap-1">
        {[
          {
            name: "Provider Settings",
            summary: "Default provider, timeouts, retry policy",
            values: "OpenAI · 30s timeout",
          },
          {
            name: "Logging",
            summary: "Log levels, retention, export",
            values: "Info · 30 day retention",
          },
          {
            name: "Security",
            summary: "Session timeout, MFA, IP allowlist",
            values: "30 min session · MFA enabled",
          },
        ].map((group) => (
          <div
            key={group.name}
            className="flex items-center justify-between p-3 rounded-md border border-border hover:border-accent cursor-pointer transition-colors"
          >
            <div>
              <span className="text-body text-primary font-medium">{group.name}</span>
              <p className="text-meta text-muted">{group.summary}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-meta text-muted">{group.values}</span>
              <Button variant="navigation">Edit</Button>
            </div>
          </div>
        ))}
      </div>
    </SettingsManagementPage>
  );
}
