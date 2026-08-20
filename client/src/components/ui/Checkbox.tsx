import React, { forwardRef } from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  checked?: boolean;
  onChange?: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
  size?: 'sm' | 'md';
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      id,
      label,
      description,
      checked = false,
      onChange,
      size = 'md',
      disabled = false,
      error,
      className = '',
      ...props
    },
    ref
  ) => {
    const inputId = id || (typeof label === 'string' ? `checkbox-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined);

    const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.checked, e);
    };

    return (
      <div className={`flex items-start gap-3 select-none ${className}`}>
        <div className="relative flex items-center justify-center mt-0.5 shrink-0">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            checked={checked}
            onChange={handleChange}
            disabled={disabled}
            className={`appearance-none rounded-none border border-black bg-white checked:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${sizeClass} ${error ? 'border-red-600' : ''}`}
            {...props}
          />
          {checked && (
            <svg
              className={`absolute pointer-events-none text-white fill-none stroke-current stroke-[2.5] ${size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}`}
              viewBox="0 0 12 12"
            >
              <polyline points="2,6 5,9 10,3" />
            </svg>
          )}
        </div>

        {(label || description) && (
          <div className="flex flex-col text-left">
            {label && (
              <label
                htmlFor={inputId}
                className={`text-xs md:text-sm font-mono tracking-tight font-semibold text-black cursor-pointer uppercase ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {label}
              </label>
            )}
            {description && (
              <span className="text-[11px] font-mono text-neutral-500 mt-0.5 leading-relaxed">
                {description}
              </span>
            )}
            {error && (
              <span className="text-xs font-mono text-red-600 mt-0.5">
                {error}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
