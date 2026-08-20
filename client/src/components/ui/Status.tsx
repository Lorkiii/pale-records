import React from 'react';

export interface StatusProps {
  variant?: 'active' | 'warning' | 'error' | 'neutral' | 'info';
  indicator?: 'dot' | 'badge' | 'line' | 'block';
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: React.ReactNode;
  code?: string;
  className?: string;
  children?: React.ReactNode;
}

export const Status: React.FC<StatusProps> = ({
  variant = 'active',
  indicator = 'dot',
  pulse = false,
  size = 'md',
  label,
  code,
  className = '',
  children,
}) => {
  const colorMap = {
    active: {
      dot: 'bg-emerald-600',
      text: 'text-emerald-900',
      bg: 'bg-emerald-50 border-emerald-600',
      pulse: 'bg-emerald-400',
    },
    warning: {
      dot: 'bg-amber-600',
      text: 'text-amber-900',
      bg: 'bg-amber-50 border-amber-600',
      pulse: 'bg-amber-400',
    },
    error: {
      dot: 'bg-red-600',
      text: 'text-red-900',
      bg: 'bg-red-50 border-red-600',
      pulse: 'bg-red-400',
    },
    neutral: {
      dot: 'bg-neutral-500',
      text: 'text-neutral-700',
      bg: 'bg-neutral-100 border-neutral-400',
      pulse: 'bg-neutral-400',
    },
    info: {
      dot: 'bg-blue-600',
      text: 'text-blue-900',
      bg: 'bg-blue-50 border-blue-600',
      pulse: 'bg-blue-400',
    },
  }[variant];

  const sizeMap = {
    sm: 'text-[10px] py-0.5 px-1.5 gap-1.5',
    md: 'text-xs py-1 px-2 gap-2',
    lg: 'text-sm py-1.5 px-3 gap-2.5',
  }[size];

  const dotSize = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  }[size];

  if (indicator === 'badge') {
    return (
      <span
        className={`inline-flex items-center font-mono font-bold border uppercase tracking-wider select-none ${colorMap.bg} ${colorMap.text} ${sizeMap} ${className}`}
      >
        {code && <span className="opacity-75 mr-1 font-normal">[{code}]</span>}
        <span>{label || children}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-mono font-medium uppercase tracking-wider select-none text-black ${sizeMap} ${className}`}
    >
      <span className="relative flex items-center justify-center shrink-0">
        {pulse && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${colorMap.pulse}`}
          />
        )}
        <span className={`inline-block rounded-none ${dotSize} ${colorMap.dot}`} />
      </span>

      {code && <span className="text-neutral-500 font-normal">[{code}]</span>}
      <span className="tracking-tight">{label || children}</span>
    </span>
  );
};
