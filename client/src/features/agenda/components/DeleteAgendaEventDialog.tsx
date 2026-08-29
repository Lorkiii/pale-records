// Confirms deletion of an academic event or milestone before removing it from storage.
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import type { AgendaEvent } from '../agenda-types';
import { formatDateDisplay } from '../agenda-utils';

interface DeleteAgendaEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  event: AgendaEvent | null;
  onConfirm: () => void;
}

export function DeleteAgendaEventDialog({
  isOpen,
  onClose,
  event,
  onConfirm,
}: DeleteAgendaEventDialogProps) {
  if (!event) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Agenda Event"
      description="Are you sure you want to remove this academic event from your calendar?"
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Delete Event
          </Button>
        </div>
      }
    >
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
