import { useState } from "react";

import { SetupWorkflowPage } from "../../components/page-templates/SetupWorkflowPage";

/**
 * Demo page showcasing the SetupWorkflowPage template.
 *
 * Demonstrates an onboarding setup flow with progress tracking,
 * a blocker state, and compact diagnostics section.
 */
export function DemoSetupWorkflowPage() {
  const [step, setStep] = useState(2);

  return (
    <SetupWorkflowPage
      eyebrow="Setup"
      title="System Configuration"
      description="Guided setup for your ForgeFrame instance"
      currentStep={step}
      totalSteps={5}
      stepLabel="Configure Provider"
      actions={[
        { label: "Continue", kind: "primary", intent: "configure", onClick: () => setStep(Math.min(step + 1, 5)) },
      ]}
      diagnostics={
        <pre className="text-meta text-muted font-mono text-xs">
          {JSON.stringify(
            {
              configVersion: "1.2.0",
              provider: "openai",
              model: "gpt-4",
              region: "us-east-1",
              environment: "staging",
            },
            null,
            2,
          )}
        </pre>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-body text-primary font-medium mb-1">
            Provider
          </label>
          <select className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary text-body">
            <option>OpenAI</option>
            <option>Anthropic</option>
            <option>Google AI</option>
          </select>
        </div>
        <div>
          <label className="block text-body text-primary font-medium mb-1">
            API Key
          </label>
          <input
            type="password"
            className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary text-body"
            placeholder="sk-..."
          />
        </div>
        <div>
          <label className="block text-body text-primary font-medium mb-1">
            Model
          </label>
          <select className="w-full px-3 py-2 rounded-md border border-border bg-surface text-primary text-body">
            <option>gpt-4</option>
            <option>gpt-4-turbo</option>
            <option>gpt-3.5-turbo</option>
          </select>
        </div>
      </div>
    </SetupWorkflowPage>
  );
}
