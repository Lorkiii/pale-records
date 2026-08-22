import React from 'react';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  badge?: React.ReactNode;
  sectionNumber?: string;
  variant?: 'default' | 'solid-black' | 'bordered' | 'ghost';
  noPadding?: boolean;
  showCrosshairs?: boolean;
}

export const Panel: React.FC<PanelProps> = ({
  children,
  header,
  footer,
  badge,
  sectionNumber,
  variant = 'bordered',
  noPadding = false,
  showCrosshairs = true,
  className = '',
  ...props
}) => {
  const variantStyles = {
    default: 'bg-paper-light border border-paper-dark',
    bordered: 'bg-paper-light/90 border border-ink shadow-none',
    'solid-black': 'bg-ink text-paper-light border border-ink',
    ghost: 'bg-transparent border border-dashed border-paper-dark',
  }[variant];

  return (
    <div className={`relative ${variantStyles} ${className}`} {...props}>
      {showCrosshairs && (
        <>
          <span className="absolute -top-1.5 -left-1.5 text-[10px] font-mono select-none pointer-events-none text-black leading-none font-bold">
            +
          </span>
          <span className="absolute -top-1.5 -right-1.5 text-[10px] font-mono select-none pointer-events-none text-black leading-none font-bold">
            +
          </span>
          <span className="absolute -bottom-1.5 -left-1.5 text-[10px] font-mono select-none pointer-events-none text-black leading-none font-bold">
            +
          </span>
          <span className="absolute -bottom-1.5 -right-1.5 text-[10px] font-mono select-none pointer-events-none text-black leading-none font-bold">
            +
          </span>
        </>
      )}

      {header && (
        <div className="flex items-center justify-between border-b border-ink bg-paper-muted px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            {sectionNumber && (
              <span className="bg-ink px-1.5 py-0.5 font-mono text-xs font-bold text-paper-light">
                {sectionNumber}
              </span>
            )}
            <div className="font-mono text-xs font-bold uppercase tracking-widest text-ink">
              {header}
            </div>
          </div>
          {badge && <div>{badge}</div>}
        </div>
      )}

      <div className={noPadding ? '' : 'p-4 md:p-6'}>{children}</div>

      {footer && (
        <div className="border-t border-ink bg-paper-light px-4 py-2.5 font-mono text-xs text-ink-muted">
          {footer}
        </div>
      )}
    </div>
  );
};
