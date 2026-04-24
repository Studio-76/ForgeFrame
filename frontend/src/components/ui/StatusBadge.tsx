type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

type StatusBadgeProps = {
  children: React.ReactNode;
  tone?: StatusTone;
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span className="ff-status-badge" data-tone={tone}>
      {children}
    </span>
  );
}
