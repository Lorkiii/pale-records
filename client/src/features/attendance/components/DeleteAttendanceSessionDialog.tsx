// Owns confirmation and deletion of one persisted Attendance date and its roster records.
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Notice } from '../../../components/ui/Notice';
import {
  AttendanceApiError,
  deleteAttendanceSession,
} from '../attendance-api';
import { formatAttendanceDateLong } from '../attendance-draft';
import type { AttendanceSessionDraft } from '../attendance-types';

interface DeleteAttendanceSessionDialogProps {
  session: AttendanceSessionDraft;
  onClose: () => void;
  onDeleted: (sessionId: string) => void;
  onSessionExpired: () => void;
}

// Requires deliberate confirmation before permanently deleting a complete saved date.
export function DeleteAttendanceSessionDialog({
  session,
  onClose,
  onDeleted,
  onSessionExpired,
}: DeleteAttendanceSessionDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage('');

    try {
      const deletedSessionId = await deleteAttendanceSession(session.id);
      onDeleted(deletedSessionId);
    } catch (error) {
      if (error instanceof AttendanceApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to delete the attendance date. Please try again.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Delete attendance date"
      description="This permanently removes the saved roster and attendance recorded for this date."
      isDismissDisabled={isDeleting}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            isLoading={isDeleting}
          >
            {isDeleting ? 'Deleting date' : 'Delete date'}
          </Button>
        </>
      }
    >
      {errorMessage ? (
        <Notice variant="error" title="Attendance date not deleted" className="mb-5">
          {errorMessage}
        </Notice>
      ) : null}

      <p className="text-sm leading-6 text-ink-secondary">
        Delete <strong className="font-semibold text-ink">
          {formatAttendanceDateLong(session.sessionDate)}
        </strong>? Saved PALE statuses and Excused remarks for every student in this roster
        will also be deleted. This action cannot be undone.
      </p>
    </Dialog>
  );
}
