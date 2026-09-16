// Presents feedback with optional timed collapse and local dismissal for informational reminders.
import React, { useEffect, useId, useRef, useState } from 'react';

export interface NoticeProps {
  variant?: 'info' | 'warning' | 'error' | 'success' | 'system';
  title?: React.ReactNode;
  children: React.ReactNode;
  code?: string;
  onDismiss?: () => void;
  collapsible?: boolean;
  // Pass the stable source message identity to show each newly issued reminder once.
  noticeKey?: object | string;
  className?: string;
}

function CollapsibleInfoNotice({ title, children, code, onDismiss, noticeKey, className = '' }: NoticeProps) {
  const contentId = useId();
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ noticeKey, expanded: true, dismissed: false, interacted: false });

  // Reset only for a new source message, never for a newly rendered children element.
  if (state.noticeKey !== noticeKey) {
    setState({ noticeKey, expanded: true, dismissed: false, interacted: false });
  }

  useEffect(() => {
    if (!state.expanded || state.dismissed || state.interacted) return;

    const timer = window.setTimeout(() => {
      setState((current) => ({ ...current, expanded: false }));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [state.noticeKey, state.expanded, state.dismissed, state.interacted]);

  const stopAutoCollapse = () => {
    setState((current) => current.interacted ? current : { ...current, interacted: true });
  };

  const handleDismiss = () => {
    // Keep keyboard focus at the removed notice so Tab continues to the next control.
    containerRef.current?.focus({ preventScroll: true });
    setState((current) => ({ ...current, dismissed: true, interacted: true }));
    onDismiss?.();
  };

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onFocusCapture={stopAutoCollapse}
      onPointerDownCapture={stopAutoCollapse}
      className={state.dismissed ? 'sr-only' : `border border-signal-blue border-l-4 bg-paper-light text-ink ${className}`}
    >
      {state.dismissed ? (
        <span role="status">Reminder dismissed.</span>
      ) : (
        <>
          <div className="flex items-center gap-1 px-2 sm:px-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mr-1 h-5 w-5 shrink-0 text-signal-blue" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v6M12 7v1" />
            </svg>
            <span id={titleId} className="min-w-0 flex-1 py-2 font-sans text-sm font-semibold leading-5">
              {code ? <span className="mr-2 font-mono text-xs text-signal-blue">{code}</span> : null}
              {title ?? 'Information'}
            </span>
            <button
              type="button"
              aria-label={state.expanded ? 'Collapse reminder' : 'Expand reminder'}
              aria-describedby={titleId}
              aria-expanded={state.expanded}
              aria-controls={contentId}
              onClick={() => setState((current) => ({ ...current, expanded: !current.expanded, interacted: true }))}
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-signal-blue hover:bg-paper-muted"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                <path d={state.expanded ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Dismiss reminder"
              aria-describedby={titleId}
              onClick={handleDismiss}
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-ink-secondary hover:bg-paper-muted"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
                <path d="m6 6 12 12M6 18 18 6" />
              </svg>
            </button>
          </div>
          <div id={contentId} hidden={!state.expanded} role="status" aria-live="polite" aria-atomic="true" aria-labelledby={titleId} className="px-3 pb-3 font-sans text-sm leading-6 text-ink-secondary sm:px-4">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

export const Notice: React.FC<NoticeProps> = ({
  variant = 'info',
  title,
  children,
  code,
  onDismiss,
  collapsible = false,
  noticeKey,
  className = '',
}) => {
  if (variant === 'info' && collapsible) {
    return <CollapsibleInfoNotice title={title} code={code} onDismiss={onDismiss} noticeKey={noticeKey} className={className}>{children}</CollapsibleInfoNotice>;
  }

  const styles = {
    info: 'border-black bg-neutral-100 text-black',
    warning: 'border-amber-600 bg-amber-50 text-amber-950',
    error: 'border-red-600 bg-red-50 text-red-950',
    success: 'border-emerald-600 bg-emerald-50 text-emerald-950',
    system: 'border-black bg-black text-[#F4F4F0]',
  }[variant];

  const prefixIcon = {
    info: '[INFO]',
    warning: '[WARN]',
    error: '[ERR]',
    success: '[OK]',
    system: '[SYS]',
  }[variant];
  const isAssertive = variant === 'error' || variant === 'warning';

  return (
    <div
      role={isAssertive ? 'alert' : 'status'}
      aria-live={isAssertive ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`border p-3 md:p-4 font-mono text-xs select-none ${styles} ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="font-bold tracking-tighter shrink-0 font-mono">{code || prefixIcon}</span>
          <div>
            {title && <div className="font-bold uppercase tracking-wider mb-1 font-mono">{title}</div>}
            <div className="font-mono text-xs leading-relaxed opacity-90">{children}</div>
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notice"
            className="ml-2 min-h-11 shrink-0 cursor-pointer px-2 font-mono text-xs font-bold hover:underline"
          >
            [CLOSE]
          </button>
        )}
      </div>
    </div>
  );
};
