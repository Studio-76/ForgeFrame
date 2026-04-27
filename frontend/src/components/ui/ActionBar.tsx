import type { ReactNode } from "react";

type ActionBarProps = {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export function ActionBar({ title, description, actions, children }: ActionBarProps) {
  return (
    <section className="ff-action-bar">
      {(title || description || actions) ? (
        <div className="ff-action-bar-header">
          <div className="ff-action-bar-copy">
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="ff-action-bar-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children ? <div className="ff-action-bar-body">{children}</div> : null}
    </section>
  );
}
