import { Button } from "../../components/ui/Button";
import { ReviewQueuePage } from "../../components/page-templates/ReviewQueuePage";

/**
 * Demo page showcasing the ReviewQueuePage template.
 *
 * Demonstrates a learning review queue with summary stats,
 * a review table, detail hint, and diagnostics section.
 */
export function DemoReviewQueuePage() {
  return (
    <ReviewQueuePage
      eyebrow="Knowledge"
      title="Learning Review"
      description="Review learning events and promote to memory or skills"
      summaryItems={[
        { key: "pending", label: "Pending review", value: 12, tone: "warning" },
        { key: "overdue", label: "Overdue", value: 3, tone: "danger" },
        { key: "total", label: "Total events", value: 45 },
      ]}
      actions={[
        { label: "Review all pending", kind: "primary", intent: "review", onClick: () => {} },
      ]}
      emptyDetailHint="Select an item from the queue to review its details and take action."
      diagnostics={
        <pre className="text-meta text-muted font-mono text-xs">
          {JSON.stringify(
            {
              lastScan: "2026-05-04T10:30:00Z",
              totalEvents: 45,
              promotedToMemory: 12,
              promotedToSkills: 3,
              dismissed: 8,
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
            <th className="py-2 pr-4 font-medium">Priority</th>
            <th className="py-2 pr-4 font-medium">Event</th>
            <th className="py-2 pr-4 font-medium">Source</th>
            <th className="py-2 pr-4 font-medium">Age</th>
            <th className="py-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {[
            { priority: "High", event: "Conversation pattern detected", source: "Chat #42", age: "2h" },
            { priority: "Medium", event: "Frequent topic cluster", source: "Chat #38", age: "6h" },
            { priority: "Medium", event: "Workflow improvement signal", source: "Execution #104", age: "1d" },
            { priority: "Low", event: "User preference noted", source: "Chat #15", age: "3d" },
          ].map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              <td className="py-2 pr-4">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-meta font-medium ${
                    row.priority === "High"
                      ? "bg-danger/15 text-danger"
                      : row.priority === "Medium"
                        ? "bg-warning/15 text-warning"
                        : "bg-surface-subtle text-muted"
                  }`}
                >
                  {row.priority}
                </span>
              </td>
              <td className="py-2 pr-4 text-primary font-medium">{row.event}</td>
              <td className="py-2 pr-4 text-muted">{row.source}</td>
              <td className="py-2 pr-4 text-muted">{row.age}</td>
              <td className="py-2">
                <div className="flex gap-1">
                  <Button variant="primary" density="compact" size="sm">
                    Approve
                  </Button>
                  <Button variant="destructive" density="compact" size="sm">
                    Reject
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReviewQueuePage>
  );
}
