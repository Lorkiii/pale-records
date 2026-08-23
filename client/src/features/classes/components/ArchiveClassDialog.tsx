// Owns archive confirmation and the persisted archive request for a selected class.
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Notice } from '../../../components/ui/Notice';
import { archiveClass, ClassApiError } from '../classes-api';
import type { ClassRecord } from '../class-types';

interface ArchiveClassDialogProps {
  classRecord: ClassRecord;
  onClose: () => void;
  onArchived: (classId: string) => void;
  onSessionExpired: () => void;
}

// Confirms and persists a non-destructive archive action for one selected class.
export function ArchiveClassDialog({
  classRecord,
  onClose,
  onArchived,
  onSessionExpired,
}: ArchiveClassDialogProps) {
  const [isArchiving, setIsArchiving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Archives the selected class while handling expired sessions and recoverable failures.
  const handleArchive = async () => {
    setIsArchiving(true);
    setErrorMessage('');

    try {
      const archivedClassId = await archiveClass(classRecord.id);
      onArchived(archivedClassId);
    } catch (error) {
      if (error instanceof ClassApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to archive the class. Please try again.',
      );
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Archive class"
      description="Archived classes are removed from the active class directory."
      isDismissDisabled={isArchiving}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isArchiving}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleArchive}
            isLoading={isArchiving}
          >
            {isArchiving ? 'Archiving class' : 'Archive class'}
          </Button>
        </>
      }
    >
      {errorMessage ? (
        <Notice variant="error" title="Class not archived" className="mb-5">
          {errorMessage}
        </Notice>
      ) : null}

      <p className="text-sm leading-6 text-ink-secondary">
        Archive <strong className="font-semibold text-ink">{classRecord.subjectName}</strong>?
        Its class record and related data will be kept, but the class will no longer appear in
        the active directory.
      </p>
    </Dialog>
  );
}
