import React from 'react';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  optional?: boolean;
  subtext?: string;
  size?: 'sm' | 'md' | 'lg';
  isMonospace?: boolean;
  badge?: React.ReactNode;
}

export const Label: React.FC<LabelProps> = ({
  children,
  className = '',
  required = false,
  optional = false,
  subtext,
  size = 'md',
  isMonospace = true,
  badge,
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-xs',
    md: 'text-xs md:text-sm',
    lg: 'text-sm md:text-base',
  }[size];

  const fontStyle = isMonospace ? 'font-mono' : 'font-sans';

  return (
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <label
        className={`inline-flex items-center gap-1.5 tracking-wider font-semibold text-black uppercase select-none ${sizeStyles} ${fontStyle} ${className}`}
        {...props}
      >
        <span>{children}</span>
        {required && (
          <span className="text-red-600 font-bold" title="Required field" aria-hidden="true">
            *
          </span>
        )}
        {optional && (
          <span className="text-neutral-500 text-[10px] font-normal normal-case">
            (optional)
          </span>
        )}
        {badge && <span className="ml-1">{badge}</span>}
      </label>
      {subtext && (
        <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-tight">
          {subtext}
        </span>
      )}
    </div>
  );
};
