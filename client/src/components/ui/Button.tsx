import React, { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline' | 'subtle';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-mono uppercase tracking-wider select-none transition-all duration-150 rounded-none focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:translate-y-[1px]';

    const sizeStyles = {
      xs: 'text-xs px-2.5 py-1 gap-1.5 h-7',
      sm: 'text-xs px-3.5 py-1.5 gap-2 h-8.5',
      md: 'text-sm px-5 py-2.5 gap-2.5 h-11',
      lg: 'text-base px-6 py-3.5 gap-3 h-13',
      icon: 'p-2.5 h-11 w-11 shrink-0 justify-center',
    }[size];

    const variantStyles = {
      primary:
        'bg-black text-[#F4F4F0] border border-black hover:bg-neutral-900 active:bg-neutral-800 shadow-none',
      secondary:
        'bg-transparent text-black border border-black hover:bg-black hover:text-[#F4F4F0] active:bg-neutral-900',
      outline:
        'bg-white text-black border border-neutral-400 hover:border-black hover:bg-neutral-100',
      ghost:
        'bg-transparent text-black border border-transparent hover:bg-black/5 active:bg-black/10',
      destructive:
        'bg-red-700 text-white border border-red-700 hover:bg-red-800 active:bg-red-900',
      subtle:
        'bg-neutral-200 text-black border border-neutral-300 hover:bg-neutral-300',
    }[variant];

    const widthStyle = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${widthStyle} ${className}`}
        {...props}
      >
        {isLoading && (
          <span
            className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent animate-spin mr-1.5"
            aria-hidden="true"
          />
        )}
        {!isLoading && leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>}
        <span className="truncate">{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex shrink-0 items-center">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
