// Renders a labeled input with connected hint, validation, and password-visibility controls.
import React, { forwardRef, useId, useState } from 'react';
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
    const generatedId = useId().replace(/:/g, '');
    const inputId = id || `input-${generatedId}`;

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
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const describedBy = [hint ? hintId : null, error ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined;

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
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            aria-errormessage={error ? errorId : undefined}
            className={`w-full rounded-none text-black placeholder:text-neutral-400 transition-colors focus:outline-none disabled:opacity-50 disabled:bg-neutral-100 disabled:cursor-not-allowed ${sizeStyles} ${variantStyles} ${errorStyles} ${fontStyle} ${leftElement ? 'pl-9' : ''} ${rightElement || (isPassword && allowPasswordToggle) ? 'pr-14' : ''} ${className}`}
            {...props}
          />

          {isPassword && allowPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-0 flex h-11 min-w-11 cursor-pointer select-none items-center justify-center border-l border-neutral-300 px-2 font-mono text-[10px] uppercase text-neutral-600 hover:bg-neutral-100 hover:text-black focus:outline-none"
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

        {hint && (
          <p id={hintId} className="mt-1 text-xs font-mono text-neutral-600">
            {hint}
          </p>
        )}

        {error && (
          <p id={errorId} className="mt-1 text-xs font-mono text-red-600 flex items-center gap-1">
            <span aria-hidden="true">/!/</span>
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
