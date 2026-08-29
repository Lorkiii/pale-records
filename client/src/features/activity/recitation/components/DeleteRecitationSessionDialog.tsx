// Confirms and performs permanent deletion of one complete Recitation date.
import { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { Dialog } from '../../../../components/ui/Dialog';
import { Notice } from '../../../../components/ui/Notice';
import {
  deleteRecitationSession,
  RecitationApiError,
} from '../recitation-api';
import { formatRecitationDateLong } from '../recitation-draft';
import type { RecitationSessionDraft } from '../recitation-types';

interface DeleteRecitationSessionDialogProps {
  session: RecitationSessionDraft;
  hasUnsavedChanges: boolean;
  onClose: () => void;
  onDeleted: (sessionId: string) => void;
  onSessionExpired: () => void;
}

// Requires deliberate confirmation before deleting saved and unsaved date state.
export function DeleteRecitationSessionDialog({
  session,
  hasUnsavedChanges,
  onClose,
  onDeleted,
  onSessionExpired,
}: DeleteRecitationSessionDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage('');

    try {
      const deletedSessionId = await deleteRecitationSession(session.id);
      onDeleted(deletedSessionId);
    } catch (error) {
      if (error instanceof RecitationApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to delete the Recitation date. Please try again.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Delete Recitation date"
      description="This permanently removes the date, its saved roster marks, and local unsaved edits."
      isDismissDisabled={isDeleting}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            isLoading={isDeleting}
          >
            {isDeleting ? 'Deleting Recitation' : 'Delete Recitation'}
          </Button>
        </>
      }
    >
      {errorMessage ? (
        <Notice
          variant="error"
          title="Recitation date not deleted"
          className="mb-5"
        >
          {errorMessage}
        </Notice>
      ) : null}

      <p className="text-sm leading-6 text-ink-secondary">
        Delete{' '}
        <strong className="font-semibold text-ink">
          {formatRecitationDateLong(session.sessionDate)}
        </strong>
        ? Every saved Check, X, and Unmarked roster record for this date will
        also be deleted. This action cannot be undone.
      </p>

      {hasUnsavedChanges ? (
        <Notice variant="warning" title="Unsaved edits will be discarded" className="mt-5">
          The marks changed during this edit will be permanently discarded with the date.
        </Notice>
      ) : null}
    </Dialog>
  );
}
