// Owns archive confirmation and persistence for one selected active student.
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Notice } from '../../../components/ui/Notice';
import { archiveStudent, StudentApiError } from '../students-api';
import type { StudentRecord } from '../student-types';

interface ArchiveStudentDialogProps {
  studentRecord: StudentRecord;
  onClose: () => void;
  onArchived: (studentId: string) => void;
  onSessionExpired: () => void;
}

// Confirms a non-destructive archive while preserving historical attendance data.
export function ArchiveStudentDialog({
  studentRecord,
  onClose,
  onArchived,
  onSessionExpired,
}: ArchiveStudentDialogProps) {
  const [isArchiving, setIsArchiving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Archives the selected student and handles expired sessions or recoverable failures.
  const handleArchive = async () => {
    setIsArchiving(true);
    setErrorMessage('');

    try {
      const archivedStudentId = await archiveStudent(studentRecord.id);
      onArchived(archivedStudentId);
    } catch (error) {
      if (error instanceof StudentApiError && error.status === 401) {
        onSessionExpired();
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to archive the student. Please try again.',
      );
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Archive student"
      description="Archived students are removed from the active student directory."
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
            {isArchiving ? 'Archiving student' : 'Archive student'}
          </Button>
        </>
      }
    >
      {errorMessage ? (
        <Notice variant="error" title="Student not archived" className="mb-5">
          {errorMessage}
        </Notice>
      ) : null}

      <p className="text-sm leading-6 text-ink-secondary">
        Archive{' '}
        <strong className="font-semibold text-ink">
          {studentRecord.firstName} {studentRecord.lastName}
        </strong>
        ? Their saved record and historical attendance will be kept, but they will no longer
        appear in the active directory or new attendance rosters.
      </p>
    </Dialog>
  );
}
