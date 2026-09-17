// Displays archived classes with protected-history explanations and deletion selection.
import { Checkbox } from '../../../components/ui/Checkbox';
import { ArchivePager, ArchiveSelectionToolbar } from '../../archive/ArchiveControls';
import type { ArchivedClassRecord } from '../../archive/archive-types';
import { formatDateOnly, type DateFormatPreference } from '../../settings/preference-display';

interface ArchivedClassDirectoryProps {
  records: ArchivedClassRecord[];
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

export function ArchivedClassDirectory({
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
}: ArchivedClassDirectoryProps) {
  return (
    <section aria-labelledby="archived-classes-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-muted">Class archive</p>
          <h2 id="archived-classes-heading" className="mt-1 font-display text-2xl font-semibold text-ink">Archived classes</h2>
        </div>
        <span className="text-sm text-ink-secondary">{records.length} on this page</span>
      </div>
      {records.length === 0 ? (
        <p className="border border-ink bg-paper-light p-6 text-sm text-ink-secondary">
          No archived classes on this page.
        </p>
      ) : (
        <>
          <ArchiveSelectionToolbar
            deleteButtonId="class-archive-delete-trigger"
            eligibleCount={eligibleIds.length}
            selectedCount={selectedIds.length}
            onSelectPage={onSelectPage}
            onDelete={onDelete}
            onRefresh={onRefresh}
          />
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {records.map((record) => (
              <li key={record.id} className="min-w-0 border border-ink bg-paper-light p-4">
                <Checkbox
                  id={`select-archived-class-${record.id}`}
                  aria-label={`Select ${record.subjectName}${record.section ? `, ${record.section}` : ''}`}
                  label={<span className="break-words font-sans text-base font-semibold normal-case tracking-normal">{record.subjectName}</span>}
                  checked={selectedIds.includes(record.id)}
                  disabled={!record.canDelete}
                  onChange={() => onToggle(record.id)}
                />
                <p className="mt-2 break-words text-sm text-ink-secondary">
                  {[record.subjectCode, record.section, record.schoolYear, record.semester].filter(Boolean).join(' / ') || 'No additional class details'}
                </p>
                <p className="mt-3 border-t border-paper-border pt-3 font-mono text-xs text-ink-secondary">
                  Archived {formatDateOnly(record.archivedAt.slice(0, 10), dateFormat)}
                </p>
                {!record.canDelete ? (
                  <p className="mt-2 text-sm text-signal-red">
                    Saved attendance, recitation, or Agenda history prevents deletion.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
      <ArchivePager page={page} hasMore={hasMore} onPageChange={onPageChange} />
    </section>
  );
}
