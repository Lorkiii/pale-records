// Confirms the target account and reports sequential legacy Agenda import progress safely.
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Notice } from '../../../components/ui/Notice';

interface AgendaLegacyImportDialogProps {
  isOpen: boolean;
  eventCount: number;
  accountName: string;
  accountEmail: string;
  isImporting: boolean;
  currentIndex: number;
  importedCount: number;
  alreadyImportedCount: number;
  removedClassAssociationCount: number;
  errorMessage: string;
  onClose: () => void;
  onImport: () => Promise<void>;
}

export function AgendaLegacyImportDialog({
  isOpen,
  eventCount,
  accountName,
  accountEmail,
  isImporting,
  currentIndex,
  importedCount,
  alreadyImportedCount,
  removedClassAssociationCount,
  errorMessage,
  onClose,
  onImport,
}: AgendaLegacyImportDialogProps) {
  const acknowledgedCount = importedCount + alreadyImportedCount;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Import Browser Agenda Events"
      description="Review the account destination before copying legacy browser events into the database."
      isDismissDisabled={isImporting}
      footer={
        <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isImporting}>
            Not now
          </Button>
          <Button
            variant="primary"
            onClick={() => void onImport()}
            isLoading={isImporting}
          >
            {isImporting
              ? `Importing ${currentIndex} of ${eventCount}`
              : errorMessage ? 'Retry safe import' : 'Import into this account'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Notice variant="warning" title="Confirm the account owner">
          Browser localStorage is shared by PALE accounts using this browser profile and origin.
          These events may have been created while another PALE account was signed in. Import only
          if they belong to the account shown below.
        </Notice>

        <div className="grid gap-px border border-ink bg-ink sm:grid-cols-2">
          <div className="bg-paper-light p-4">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">
              Importable events
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-ink">{eventCount}</p>
          </div>
          <div className="bg-paper-light p-4">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">
              Destination account
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">{accountName}</p>
            <p className="mt-0.5 break-all text-sm text-ink-secondary">{accountEmail}</p>
          </div>
        </div>

        <div role="status" aria-live="polite" className="border border-paper-border bg-paper p-4">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-ink-muted">
            Import status
          </p>
          <p className="mt-1 text-sm text-ink-secondary">
            {isImporting
              ? `Importing ${currentIndex} of ${eventCount}. Keep this dialog open.`
              : errorMessage
                ? `Import paused after ${acknowledgedCount} of ${eventCount} acknowledgements.`
                : `Ready to import ${eventCount} validated local events sequentially.`}
          </p>
          {acknowledgedCount > 0 ? (
            <dl className="mt-3 grid grid-cols-1 gap-2 font-mono text-xs sm:grid-cols-3">
              <div>
                <dt className="text-ink-muted">Imported</dt>
                <dd className="font-bold text-ink">{importedCount}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Already imported</dt>
                <dd className="font-bold text-ink">{alreadyImportedCount}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Class links cleared</dt>
                <dd className="font-bold text-ink">{removedClassAssociationCount}</dd>
              </div>
            </dl>
          ) : null}
        </div>

        {errorMessage ? (
          <Notice variant="error" title="Legacy import not finished">
            {errorMessage}
          </Notice>
        ) : null}
      </div>
    </Dialog>
  );
}
