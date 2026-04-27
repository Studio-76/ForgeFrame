import { StatusBadge } from "./StatusBadge";

type StateBlockProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

type BlockedStateProps = StateBlockProps & {
  status?: string | null;
  badgeLabel?: string;
};

function StateFrame({
  state,
  title,
  description,
  action,
  badge,
}: StateBlockProps & { state: string; badge?: React.ReactNode }) {
  return (
    <div className="ff-state-block" data-state={state}>
      {badge ? <div className="ff-state-badge">{badge}</div> : null}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="ff-state-actions">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: StateBlockProps) {
  return <StateFrame state="empty" title={title} description={description} action={action} />;
}

export function ErrorState({ title, description, action }: StateBlockProps) {
  return <StateFrame state="error" title={title} description={description} action={action} />;
}

export function LoadingState({ title = "Loading", description }: Partial<StateBlockProps>) {
  return (
    <div className="ff-state-block" data-state="loading">
      <div className="ff-skeleton-row" />
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="ff-skeleton-stack" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="ff-skeleton-row" />
      ))}
    </div>
  );
}

export function PermissionState({ title, description, action }: StateBlockProps) {
  return (
    <StateFrame
      state="permission"
      title={title}
      description={description}
      action={action}
      badge={<StatusBadge status="waiting_approval">Permission limited</StatusBadge>}
    />
  );
}

export function BlockedState({ title, description, action, status = "blocked", badgeLabel }: BlockedStateProps) {
  const normalizedStatus = status ?? "blocked";

  return (
    <StateFrame
      state="blocked"
      title={title}
      description={description}
      action={action}
      badge={<StatusBadge status={normalizedStatus}>{badgeLabel ?? normalizedStatus.replace(/_/g, " ")}</StatusBadge>}
    />
  );
}
