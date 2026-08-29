// Presents the four compact record actions with accessible labels and viewport-safe tooltips.
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, type ButtonProps } from './Button';

type ActionIcon = 'edit' | 'save' | 'cancel' | 'delete';

interface ActionIconButtonProps
  extends Omit<
    ButtonProps,
    'aria-label' | 'children' | 'isLoading' | 'leftIcon' | 'rightIcon' | 'size'
  > {
  icon: ActionIcon;
  label: string;
  tooltip: string;
  isLoading?: boolean;
}

interface TooltipPosition {
  left: number;
  top: number;
}

const TOOLTIP_MAX_WIDTH = 192;
const TOOLTIP_VIEWPORT_GAP = 8;

function Icon({ name }: { name: ActionIcon }) {
  const iconProps = {
    'aria-hidden': true,
    className: 'h-4.5 w-4.5',
    fill: 'none',
    focusable: false,
    stroke: 'currentColor',
    strokeLinecap: 'square' as const,
    strokeLinejoin: 'miter' as const,
    strokeWidth: 1.75,
    viewBox: '0 0 24 24',
  };

  if (name === 'edit') {
    return (
      <svg {...iconProps}>
        <path d="m4 20 4.25-1 10.5-10.5a2.12 2.12 0 0 0-3-3L5.25 16 4 20Z" />
        <path d="m14.5 6.75 3 3" />
      </svg>
    );
  }

  if (name === 'save') {
    return (
      <svg {...iconProps}>
        <path d="M5 3h11l3 3v15H5V3Z" />
        <path d="M8 3v6h8V3M8 21v-7h8v7" />
      </svg>
    );
  }

  if (name === 'cancel') {
    return (
      <svg {...iconProps}>
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
    );
  }

  return (
    <svg {...iconProps}>
      <path d="M4 7h16M9 7V4h6v3M18 7l-1 14H7L6 7M10 11v6M14 11v6" />
    </svg>
  );
}

// Keeps tooltip copy inside the viewport even when an action sits at a narrow-screen edge.
function getTooltipPosition(element: HTMLElement): TooltipPosition {
  const rect = element.getBoundingClientRect();
  const availableWidth = Math.max(window.innerWidth - TOOLTIP_VIEWPORT_GAP * 2, 0);
  const tooltipWidth = Math.min(TOOLTIP_MAX_WIDTH, availableWidth);
  const halfTooltipWidth = tooltipWidth / 2;
  const minimumLeft = TOOLTIP_VIEWPORT_GAP + halfTooltipWidth;
  const maximumLeft = window.innerWidth - TOOLTIP_VIEWPORT_GAP - halfTooltipWidth;

  return {
    left: Math.min(
      Math.max(rect.left + rect.width / 2, minimumLeft),
      maximumLeft,
    ),
    top: rect.top - TOOLTIP_VIEWPORT_GAP,
  };
}

export function ActionIconButton({
  icon,
  label,
  tooltip,
  isLoading = false,
  variant = 'primary',
  ...buttonProps
}: ActionIconButtonProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const isTooltipVisible = isHovered || isFocused;

  const updateTooltipPosition = () => {
    if (wrapperRef.current) {
      setTooltipPosition(getTooltipPosition(wrapperRef.current));
    }
  };

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex shrink-0"
      onMouseEnter={() => {
        updateTooltipPosition();
        setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => {
        updateTooltipPosition();
        setIsFocused(true);
      }}
      onBlurCapture={() => setIsFocused(false)}
    >
      <Button
        {...buttonProps}
        aria-label={label}
        size="icon"
        variant={variant}
      >
        {isLoading ? (
          <span
            className="inline-block h-4 w-4 animate-spin border-2 border-current border-t-transparent motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <Icon name={icon} />
        )}
      </Button>

      {isTooltipVisible && tooltipPosition && typeof document !== 'undefined'
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-50 w-max -translate-x-1/2 -translate-y-full border border-ink bg-ink px-2.5 py-1.5 text-center font-mono text-[10px] font-semibold uppercase leading-4 tracking-[0.1em] text-paper-light"
              style={{
                ...tooltipPosition,
                maxWidth: `min(${TOOLTIP_MAX_WIDTH}px, calc(100vw - ${TOOLTIP_VIEWPORT_GAP * 2}px))`,
              }}
            >
              {tooltip}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
