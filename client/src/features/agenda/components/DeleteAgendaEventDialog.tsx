// Confirms and awaits deletion of one Agenda event while preserving it after failure.
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Notice } from '../../../components/ui/Notice';
import type { AgendaEvent } from '../agenda-types';
import { formatDateDisplay } from '../agenda-utils';

interface DeleteAgendaEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event: AgendaEvent | null;
  onConfirm: () => Promise<void>;
}

export function DeleteAgendaEventDialog({
  isOpen,
  onClose,
  event,
  onConfirm,
}: DeleteAgendaEventDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!event) return null;

  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    setErrorMessage('');
    try {
      await onConfirm();
      onClose();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to delete this Agenda event. Please try again.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Agenda Event"
      description="Are you sure you want to remove this academic event from your calendar?"
      isDismissDisabled={isDeleting}
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={handleDelete}
            isLoading={isDeleting}
          >
            {isDeleting ? 'Deleting Event' : 'Delete Event'}
          </Button>
        </div>
      }
    >
      {errorMessage ? (
        <Notice variant="error" title="Agenda event not deleted" className="mb-5">
          {errorMessage}
        </Notice>
      ) : null}

      <div className="border border-paper-border bg-paper p-4 text-ink">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">
          Event to Remove
        </p>
        <p className="mt-1 font-display text-lg font-bold text-ink">{event.title}</p>
        <p className="mt-1 font-mono text-xs text-ink-secondary">
          Date: {formatDateDisplay(event.eventDate)}
          {event.startTime ? ` • ${event.startTime}` : ''}
        </p>
      </div>
    </Dialog>
  );
}
