import React from 'react';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  variant?: 'solid' | 'dashed' | 'dotted' | 'double' | 'hairline';
  label?: React.ReactNode;
  labelPosition?: 'left' | 'center' | 'right';
  className?: string;
  spacing?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  variant = 'solid',
  label,
  labelPosition = 'center',
  className = '',
  spacing = 'md',
}) => {
  const borderStyle = {
    solid: 'border-solid border-neutral-300',
    hairline: 'border-solid border-black',
    dashed: 'border-dashed border-neutral-400',
    dotted: 'border-dotted border-neutral-400',
    double: 'border-double border-neutral-400 border-b-2',
  }[variant];

  if (orientation === 'vertical') {
    const verticalSpacing = {
      none: 'mx-0',
      sm: 'mx-2',
      md: 'mx-4',
      lg: 'mx-6',
      xl: 'mx-8',
    }[spacing];

    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={`self-stretch border-r border-black ${verticalSpacing} ${className}`}
      />
    );
  }

  const horizontalSpacing = {
    none: 'my-0',
    sm: 'my-2',
    md: 'my-4',
    lg: 'my-6',
    xl: 'my-8',
  }[spacing];

  if (!label) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        className={`w-full border-b ${borderStyle} ${horizontalSpacing} ${className}`}
      />
    );
  }

  const justifyClass = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[labelPosition];

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={`relative flex items-center ${justifyClass} w-full ${horizontalSpacing} ${className}`}
    >
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className={`w-full border-b ${borderStyle}`} />
      </div>
      <span className="relative z-10 bg-[#F4F4F0] px-3 font-mono text-[11px] uppercase tracking-widest text-neutral-600 font-semibold">
        {label}
      </span>
    </div>
  );
};
