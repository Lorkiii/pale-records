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
    default: 'bg-white border border-neutral-400',
    bordered: 'bg-white/90 border border-black shadow-none',
    'solid-black': 'bg-black text-[#F4F4F0] border border-black',
    ghost: 'bg-transparent border border-dashed border-neutral-400',
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
        <div className="flex items-center justify-between border-b border-black px-4 py-2.5 bg-neutral-100/90">
          <div className="flex items-center gap-2.5">
            {sectionNumber && (
              <span className="font-mono text-xs font-bold bg-black text-[#F4F4F0] px-1.5 py-0.5">
                {sectionNumber}
              </span>
            )}
            <div className="font-mono text-xs uppercase tracking-widest font-bold text-black">
              {header}
            </div>
          </div>
          {badge && <div>{badge}</div>}
        </div>
      )}

      <div className={noPadding ? '' : 'p-4 md:p-6'}>{children}</div>

      {footer && (
        <div className="border-t border-black px-4 py-2.5 bg-neutral-50 font-mono text-xs text-neutral-600">
          {footer}
        </div>
      )}
    </div>
  );
};
