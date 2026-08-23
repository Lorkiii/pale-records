// Provides an accessible native modal shell for focused forms and confirmations.
import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  isDismissDisabled?: boolean;
}

// Synchronizes an accessible native dialog with React-controlled open and dismiss states.
export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  isDismissDisabled = false,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Closes only direct backdrop clicks while preserving interactions inside the dialog.
  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && !isDismissDisabled) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(44rem,calc(100vw-2rem))] overflow-hidden border border-ink bg-paper-light p-0 text-ink backdrop:bg-ink/45"
      onCancel={(event) => {
        event.preventDefault();
        if (!isDismissDisabled) {
          onClose();
        }
      }}
      onClick={handleBackdropClick}
    >
      <div className="flex max-h-[calc(100vh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-6 border-b border-ink bg-paper-muted px-5 py-4 sm:px-6">
          <div>
            <h2 id={titleId} className="font-display text-xl font-semibold tracking-[-0.03em] text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 max-w-xl text-sm leading-5 text-ink-secondary">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={isDismissDisabled}
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-ink bg-paper-light font-mono text-lg text-ink hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">{children}</div>

        {footer ? (
          <footer className="flex flex-col-reverse gap-3 border-t border-ink bg-paper-muted px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
