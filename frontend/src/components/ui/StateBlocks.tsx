type StateBlockProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: StateBlockProps) {
  return (
    <div className="ff-state-block" data-state="empty">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="ff-state-actions">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title, description, action }: StateBlockProps) {
  return (
    <div className="ff-state-block" data-state="error">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="ff-state-actions">{action}</div> : null}
    </div>
  );
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
