import React from 'react';

export interface MetadataFieldProps {
  label: React.ReactNode;
  value: React.ReactNode;
  code?: string;
  isMonospace?: boolean;
  copyable?: boolean;
  highlight?: boolean;
  status?: React.ReactNode;
  layout?: 'horizontal' | 'stacked' | 'inline';
  className?: string;
}

export const MetadataField: React.FC<MetadataFieldProps> = ({
  label,
  value,
  code,
  isMonospace = true,
  copyable = false,
  highlight = false,
  status,
  layout = 'horizontal',
  className = '',
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (typeof value === 'string' || typeof value === 'number') {
      navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const fontClass = isMonospace ? 'font-mono' : 'font-sans';

  if (layout === 'stacked') {
    return (
      <div className={`flex flex-col gap-0.5 text-left ${className}`}>
        <span className="font-mono text-[10px] md:text-[11px] uppercase tracking-widest text-neutral-500 font-medium">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {code && <span className="font-mono text-xs text-neutral-400 font-normal">[{code}]</span>}
          <span
            className={`text-xs md:text-sm font-semibold tracking-tight ${fontClass} ${highlight ? 'text-black bg-neutral-200 px-1' : 'text-neutral-900'}`}
          >
            {value}
          </span>
          {status && <span className="ml-1">{status}</span>}
          {copyable && (
            <button
              type="button"
              onClick={handleCopy}
              className="text-[10px] font-mono text-neutral-500 hover:text-black uppercase cursor-pointer underline"
            >
              {copied ? '[COPIED]' : '[COPY]'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 text-xs md:text-sm py-1.5 border-b border-neutral-200 last:border-b-0 ${className}`}
    >
      <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-600 shrink-0 font-medium">
        {label}
      </span>
      <div className="flex items-center gap-2 text-right truncate">
        {code && <span className="font-mono text-xs text-neutral-400">[{code}]</span>}
        <span
          className={`font-semibold tracking-tight truncate ${fontClass} ${highlight ? 'text-black font-bold' : 'text-neutral-900'}`}
        >
          {value}
        </span>
        {status && <span>{status}</span>}
        {copyable && (
          <button
            type="button"
            onClick={handleCopy}
            className="text-[10px] font-mono text-neutral-500 hover:text-black uppercase cursor-pointer ml-1"
          >
            {copied ? '[COPIED]' : '[COPY]'}
          </button>
        )}
      </div>
    </div>
  );
};

export interface MetadataGroupProps {
  title?: React.ReactNode;
  code?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bordered?: boolean;
}

export const MetadataGroup: React.FC<MetadataGroupProps> = ({
  title,
  code,
  action,
  children,
  className = '',
  bordered = true,
}) => {
  return (
    <div
      className={`w-full ${bordered ? 'border border-black bg-white/70 p-3.5 md:p-4' : ''} ${className}`}
    >
      {(title || code || action) && (
        <div className="flex items-center justify-between border-b border-black pb-2 mb-2.5">
          <div className="flex items-center gap-2">
            {code && (
              <span className="font-mono text-xs bg-black text-[#F4F4F0] px-1.5 py-0.5 font-bold">
                {code}
              </span>
            )}
            {title && (
              <span className="font-mono text-xs uppercase tracking-widest font-bold text-black">
                {title}
              </span>
            )}
          </div>
          {action && <div className="text-xs font-mono">{action}</div>}
        </div>
      )}
      <div className="flex flex-col">{children}</div>
    </div>
  );
};

export const Metadata = ({ children, className = '' }: { children?: React.ReactNode; className?: string }) => {
  return <div className={className}>{children}</div>;
};

Metadata.Field = MetadataField;
Metadata.Group = MetadataGroup;


