// Renders active students with their enrolled classes and edit/archive actions.
import { useRef, type FocusEvent } from 'react';
import {
  getTableDensityClasses,
  type TableDensityPreference,
} from '../../settings/preference-display';
import type { StudentRecord } from '../student-types';

interface StudentDirectoryProps {
  students: StudentRecord[];
  tableDensity?: TableDensityPreference;
  canEdit: boolean;
  onEdit: (student: StudentRecord) => void;
  onArchive: (student: StudentRecord) => void;
}

interface StudentActionsProps {
  student: StudentRecord;
  canEdit: boolean;
  onEdit: (student: StudentRecord) => void;
  onArchive: (student: StudentRecord) => void;
}

// Renders one native action menu and closes it after selection or lost focus.
function StudentActions({ student, canEdit, onEdit, onArchive }: StudentActionsProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const closeMenu = () => {
    detailsRef.current?.removeAttribute('open');
  };

  const handleEdit = () => {
    closeMenu();
    onEdit(student);
  };

  const handleArchive = () => {
    closeMenu();
    onArchive(student);
  };

  const handleBlur = (event: FocusEvent<HTMLDetailsElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      closeMenu();
    }
  };

  return (
    <details ref={detailsRef} className="relative" onBlur={handleBlur}>
      <summary className="flex h-10 cursor-pointer list-none items-center gap-2 border border-ink bg-paper-light px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink hover:bg-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        Actions
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-36 border border-ink bg-paper-light p-1">
        <button
          type="button"
          className="flex min-h-10 w-full cursor-pointer items-center px-3 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink hover:bg-paper-muted focus:outline-none focus-visible:bg-paper-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-paper-light"
          onClick={handleEdit}
          disabled={!canEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="flex min-h-10 w-full cursor-pointer items-center px-3 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em] text-signal-red hover:bg-paper-muted focus:outline-none focus-visible:bg-paper-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink"
          onClick={handleArchive}
        >
          Archive
        </button>
      </div>
    </details>
  );
}

// Presents students as responsive rows that remain readable without horizontal scrolling.
export function StudentDirectory({
  students,
  tableDensity,
  canEdit,
  onEdit,
  onArchive,
}: StudentDirectoryProps) {
  const density = getTableDensityClasses(tableDensity);

  return (
    <section aria-labelledby="student-directory-heading">
      <div className="mb-5 flex items-end gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            02 / Student directory
          </p>
          <h2 id="student-directory-heading" className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
            Current students
          </h2>
        </div>
        <span className="hidden h-px flex-1 bg-paper-dark sm:block" aria-hidden="true" />
        <span className="font-mono text-xs text-ink-muted">
          {students.length} {students.length === 1 ? 'student' : 'students'}
        </span>
      </div>

      <ol className="border border-ink bg-paper-light">
        {students.map((student, index) => (
          <li
            key={student.id}
            className={`grid border-b border-paper-border last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1.4fr)_auto] sm:items-start ${density.directoryRow}`}
          >
            <span className="w-fit bg-ink px-2 py-1 font-mono text-[11px] font-bold text-paper-light">
              {String(index + 1).padStart(2, '0')}
            </span>

            <div className="min-w-0">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Student
              </p>
              <p className="mt-1 break-words text-sm font-semibold text-ink">
                {student.lastName}, {student.firstName}
              </p>
            </div>

            <div className="min-w-0">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Student number
              </p>
              <p className="mt-1 break-words font-mono text-sm text-ink-secondary">
                {student.studentNo ?? 'Not provided'}
              </p>
            </div>

            <div className="min-w-0">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Classes
              </p>
              <ul className={`mt-1 ${density.compactStack}`}>
                {student.classes.map((classRecord) => {
                  const metadata = [classRecord.subjectCode, classRecord.section]
                    .filter(Boolean)
                    .join(' / ');

                  return (
                    <li key={classRecord.id}>
                      <p className="break-words text-sm font-medium text-ink-secondary">
                        {classRecord.subjectName}
                      </p>
                      {metadata ? (
                        <p className="mt-0.5 break-words font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                          {metadata}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>

            <StudentActions
              student={student}
              canEdit={canEdit}
              onEdit={onEdit}
              onArchive={onArchive}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
