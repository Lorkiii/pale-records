// Renders a reusable no-content message with an optional icon and action.
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  titleId?: string;
}

// Presents an honest no-content state with optional visual context and recovery action.
export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
  titleId,
}: EmptyStateProps) {
  return (
    <div className={`flex min-h-52 flex-col items-start justify-between gap-8 ${className}`}>
      {icon ? (
        <div className="flex h-11 w-11 items-center justify-center border border-paper-dark bg-paper-muted text-ink-secondary">
          {icon}
        </div>
      ) : null}
      <div>
        <h2 id={titleId} className="font-sans text-base font-semibold text-ink">{title}</h2>
        <p className="mt-1 max-w-lg text-sm leading-6 text-ink-muted">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}
