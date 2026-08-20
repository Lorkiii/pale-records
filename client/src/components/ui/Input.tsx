import React, { forwardRef, useState } from 'react';
import { Label } from './Label';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  labelSubtext?: string;
  error?: string;
  hint?: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'flushed' | 'subtle';
  isMonospace?: boolean;
  wrapperClassName?: string;
  allowPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id,
      label,
      required = false,
      optional = false,
      labelSubtext,
      error,
      hint,
      leftElement,
      rightElement,
      size = 'md',
      variant = 'default',
      isMonospace = false,
      type = 'text',
      className = '',
      wrapperClassName = '',
      disabled = false,
      allowPasswordToggle = false,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label && typeof label === 'string' ? `input-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined);

    const isPassword = type === 'password';
    const computedType = isPassword && showPassword ? 'text' : type;

    const sizeStyles = {
      sm: 'h-8 px-2.5 text-xs',
      md: 'h-11 px-3 text-sm',
      lg: 'h-13 px-4 text-base',
    }[size];

    const variantStyles = {
      default:
        'bg-white border border-neutral-400 focus:border-black focus:ring-1 focus:ring-black',
      flushed:
        'bg-transparent border-b-2 border-neutral-400 focus:border-black focus:ring-0 rounded-none px-0',
      subtle:
        'bg-neutral-100 border border-transparent focus:bg-white focus:border-black focus:ring-1 focus:ring-black',
    }[variant];

    const errorStyles = error
      ? 'border-red-600 focus:border-red-600 focus:ring-red-600 bg-red-50/20'
      : '';

    const fontStyle = isMonospace ? 'font-mono' : 'font-sans';

    return (
      <div className={`w-full ${wrapperClassName}`}>
        {label && (
          <Label
            htmlFor={inputId}
            required={required}
            optional={optional}
            subtext={labelSubtext}
            size={size}
          >
            {label}
          </Label>
        )}

        <div className="relative flex items-center w-full">
          {leftElement && (
            <div className="absolute left-3 flex items-center pointer-events-none text-neutral-500 z-10 font-mono text-xs">
              {leftElement}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={computedType}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            className={`w-full rounded-none text-black placeholder:text-neutral-400 transition-colors focus:outline-none disabled:opacity-50 disabled:bg-neutral-100 disabled:cursor-not-allowed ${sizeStyles} ${variantStyles} ${errorStyles} ${fontStyle} ${leftElement ? 'pl-9' : ''} ${rightElement || (isPassword && allowPasswordToggle) ? 'pr-14' : ''} ${className}`}
            {...props}
          />

          {isPassword && allowPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2.5 px-1 py-0.5 text-neutral-500 hover:text-black hover:bg-neutral-100 focus:outline-none cursor-pointer text-[10px] font-mono select-none uppercase border border-neutral-300"
            >
              {showPassword ? 'MASK' : 'VIEW'}
            </button>
          )}

          {!isPassword && rightElement && (
            <div className="absolute right-3 flex items-center text-neutral-500 z-10 font-mono text-xs">
              {rightElement}
            </div>
          )}
        </div>

        {error && (
          <p id={inputId ? `${inputId}-error` : undefined} className="mt-1 text-xs font-mono text-red-600 flex items-center gap-1">
            <span aria-hidden="true">/!/</span>
            <span>{error}</span>
          </p>
        )}

        {!error && hint && (
          <p id={inputId ? `${inputId}-hint` : undefined} className="mt-1 text-xs font-mono text-neutral-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
