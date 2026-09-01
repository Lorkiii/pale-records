// Renders an accessible labeled select with shared sizing, validation, and hint styles.
import React, { forwardRef, useId } from 'react';
import { Label } from './Label';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  labelSubtext?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  size?: 'sm' | 'md' | 'lg';
  isMonospace?: boolean;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      id,
      label,
      required = false,
      optional = false,
      labelSubtext,
      error,
      hint,
      options,
      size = 'md',
      isMonospace = true,
      className = '',
      wrapperClassName = '',
      disabled = false,
      ...props
    },
    ref
  ) => {
    const generatedId = useId().replace(/:/g, '');
    const selectId = id || `select-${generatedId}`;

    const sizeStyles = {
      sm: 'h-8 px-2.5 text-xs',
      md: 'h-11 px-3 text-sm',
      lg: 'h-13 px-4 text-base',
    }[size];

    const fontStyle = isMonospace ? 'font-mono' : 'font-sans';
    const errorId = `${selectId}-error`;
    const hintId = `${selectId}-hint`;
    const describedBy = [hint ? hintId : null, error ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className={`w-full ${wrapperClassName}`}>
        {label && (
          <Label
            htmlFor={selectId}
            required={required}
            optional={optional}
            subtext={labelSubtext}
            size={size}
          >
            {label}
          </Label>
        )}

        <div className="relative w-full">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            aria-errormessage={error ? errorId : undefined}
            className={`w-full appearance-none rounded-none border border-neutral-400 bg-white text-black transition-colors focus:border-black focus:ring-1 focus:ring-black focus:outline-none disabled:opacity-50 disabled:bg-neutral-100 disabled:cursor-not-allowed pr-8 cursor-pointer ${sizeStyles} ${fontStyle} ${error ? 'border-red-600 focus:border-red-600 focus:ring-red-600' : ''} ${className}`}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-black font-mono text-xs">
            ▼
          </div>
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

Select.displayName = 'Select';
