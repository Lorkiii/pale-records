// Presents assertive errors and warnings or polite informational and success feedback.
import React from 'react';

export interface NoticeProps {
  variant?: 'info' | 'warning' | 'error' | 'success' | 'system';
  title?: React.ReactNode;
  children: React.ReactNode;
  code?: string;
  onDismiss?: () => void;
  className?: string;
}

export const Notice: React.FC<NoticeProps> = ({
  variant = 'info',
  title,
  children,
  code,
  onDismiss,
  className = '',
}) => {
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
