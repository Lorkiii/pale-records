// Displays archived students with read-only details and protected-history explanations.
import { useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ArchivePager, ArchiveSelectionToolbar } from '../../archive/ArchiveControls';
import type { ArchivedStudentRecord } from '../../archive/archive-types';
import { formatDateOnly, type DateFormatPreference } from '../../settings/preference-display';
import { StudentDetailsDialog } from './StudentDetailsDialog';

interface ArchivedStudentDirectoryProps {
  records: ArchivedStudentRecord[];
  selectedIds: string[];
  eligibleIds: string[];
  page: number;
  hasMore: boolean;
  dateFormat?: DateFormatPreference;
  onToggle: (id: string) => void;
  onSelectPage: (selected: boolean) => void;
  onDelete: () => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}

export function ArchivedStudentDirectory({
  records,
  selectedIds,
  eligibleIds,
  page,
  hasMore,
  dateFormat,
  onToggle,
  onSelectPage,
  onDelete,
  onPageChange,
  onRefresh,
}: ArchivedStudentDirectoryProps) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const detailTarget = records.find((record) => record.id === detailId) ?? null;

  return (
    <section aria-labelledby="archived-students-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted">Student archive</p>
          <h2 id="archived-students-heading" tabIndex={-1} className="mt-1 font-display text-2xl font-semibold text-ink">Archived students</h2>
        </div>
        <span className="text-sm text-ink-secondary">{records.length} on this page</span>
      </div>
      {records.length === 0 ? (
        <p className="border border-ink bg-paper-light p-6 text-sm text-ink-secondary">
          No archived students on this page.
        </p>
      ) : (
        <>
          <ArchiveSelectionToolbar
            deleteButtonId="student-archive-delete-trigger"
            eligibleCount={eligibleIds.length}
            selectedCount={selectedIds.length}
            onSelectPage={onSelectPage}
            onDelete={onDelete}
            onRefresh={onRefresh}
          />
          <ul className="divide-y divide-paper-border border border-ink bg-paper-light">
            {records.map((record) => (
              <li key={record.id} className="flex flex-wrap items-start gap-3 p-4 sm:items-center">
                <Checkbox
                  id={`select-archived-student-${record.id}`}
                  aria-label={`Select ${record.firstName} ${record.lastName}`}
                  label={<span className="break-words font-sans text-sm font-semibold normal-case tracking-normal">{record.lastName}, {record.firstName}</span>}
                  checked={selectedIds.includes(record.id)}
                  disabled={!record.canDelete}
                  onChange={() => onToggle(record.id)}
                  className="min-w-0 flex-1 basis-full sm:basis-48"
                />
                <div className="min-w-0 flex-1 basis-full sm:basis-48">
                  <p className="mt-1 break-words text-sm text-ink-secondary">
                    {record.studentNo ?? 'No student number'} · Archived {formatDateOnly(record.archivedAt.slice(0, 10), dateFormat)}
                  </p>
                  {!record.canDelete ? (
                    <p className="mt-2 text-sm text-signal-red">Saved attendance or recitation history prevents deletion.</p>
                  ) : null}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full sm:w-auto"
                  aria-label={`View details for ${record.firstName} ${record.lastName}`}
                  onClick={(event) => {
                    detailTriggerRef.current = event.currentTarget;
                    setDetailId(record.id);
                  }}
                >
                  View details
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <ArchivePager page={page} hasMore={hasMore} onPageChange={(nextPage) => {
        setDetailId(null);
        onPageChange(nextPage);
      }} />
      {detailTarget ? (
        <StudentDetailsDialog student={detailTarget} archived onClose={() => {
          setDetailId(null);
          window.requestAnimationFrame(() => {
            const target = detailTriggerRef.current?.isConnected
              ? detailTriggerRef.current
              : document.getElementById('archived-students-heading');
            target?.focus();
            detailTriggerRef.current = null;
          });
        }} />
      ) : null}
    </section>
  );
}
