// Confirms one archived batch with the signed-in user's password and explains failures.
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { Notice } from '../../components/ui/Notice';
import { ArchiveApiError } from './archive-api';

interface SelectedRecord {
  id: string;
  label: string;
}

interface DeleteArchivedDialogProps {
  resourceLabel: 'class' | 'student';
  selectedRecords: SelectedRecord[];
  onConfirm: (ids: string[], currentPassword: string) => Promise<string[]>;
  onDeleted: () => void;
  onClose: () => void;
  onSessionExpired: () => void;
}

export function DeleteArchivedDialog({
  resourceLabel,
  selectedRecords,
  onConfirm,
  onDeleted,
  onClose,
  onSessionExpired,
}: DeleteArchivedDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const count = selectedRecords.length;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentPassword || isDeleting || count === 0) return;
    setIsDeleting(true);
    setErrorMessage('');
    try {
      await onConfirm(selectedRecords.map((record) => record.id), currentPassword);
      setCurrentPassword('');
      onDeleted();
    } catch (error) {
      setCurrentPassword('');
      if (error instanceof ArchiveApiError && error.status === 401) {
        onSessionExpired();
        return;
      }
      const blocked = error instanceof ArchiveApiError
        ? selectedRecords.filter((record) => error.blockedIds.includes(record.id))
        : [];
      setErrorMessage(blocked.length > 0
        ? `${error instanceof Error ? error.message : 'Deletion was blocked'} ${blocked.map((record) => record.label).join(', ')}`
        : error instanceof Error ? error.message : 'Unable to delete the selected records.');
      window.requestAnimationFrame(() => passwordRef.current?.focus());
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={`Delete archived ${resourceLabel}${count === 1 ? '' : 's'}`}
      description="This permanently removes the selected archived records."
      isDismissDisabled={isDeleting}
      initialFocusRef={passwordRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>Cancel</Button>
          <Button type="submit" form="delete-archived-form" variant="destructive" isLoading={isDeleting} disabled={!currentPassword}>
            Delete {count} {resourceLabel}{count === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      {errorMessage ? (
        <Notice variant="error" title="Records not deleted" className="mb-5">
          {errorMessage}
        </Notice>
      ) : null}
      <p className="mb-4 text-sm leading-6 text-ink-secondary">
        {count} {resourceLabel}{count === 1 ? '' : 's'} selected. This action cannot be undone.
        {resourceLabel === 'class'
          ? ' Class schedules and enrollment links will also be removed.'
          : ' Class enrollment links will also be removed.'}
      </p>
      <form id="delete-archived-form" onSubmit={handleSubmit}>
        <Input
          ref={passwordRef}
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          disabled={isDeleting}
        />
      </form>
    </Dialog>
  );
}
