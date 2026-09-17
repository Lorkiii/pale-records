// Renders a concise student directory that opens complete records in a dialog.
import { Button } from '../../../components/ui/Button';
import {
  getTableDensityClasses,
  type TableDensityPreference,
} from '../../settings/preference-display';
import type { StudentRecord } from '../student-types';

interface StudentDirectoryProps {
  students: StudentRecord[];
  tableDensity?: TableDensityPreference;
  onView: (student: StudentRecord, trigger: HTMLButtonElement) => void;
}

// Presents students as responsive rows that remain readable without horizontal scrolling.
export function StudentDirectory({
  students,
  tableDensity,
  onView,
}: StudentDirectoryProps) {
  const density = getTableDensityClasses(tableDensity);

  return (
    <section aria-labelledby="student-directory-heading">
      <div className="mb-5 flex items-end gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            02 / Student directory
          </p>
          <h2 id="student-directory-heading" tabIndex={-1} className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
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
            className={`grid grid-cols-[auto_minmax(0,1fr)] items-start border-b border-paper-border last:border-b-0 sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] sm:items-center ${density.directoryRow}`}
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

            <div className="col-start-2 min-w-0 sm:col-auto">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Student number
              </p>
              <p className="mt-1 break-words font-mono text-sm text-ink-secondary">
                {student.studentNo ?? 'Not provided'}
              </p>
            </div>

            <div className="col-start-2 min-w-0 sm:col-auto">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Classes
              </p>
              <p className="mt-1 text-sm text-ink-secondary">
                {student.classes.length} {student.classes.length === 1 ? 'class' : 'classes'}
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              className="col-span-2 min-h-11 w-full sm:col-auto sm:w-auto"
              aria-label={`View details for ${student.firstName} ${student.lastName}`}
              onClick={(event) => onView(student, event.currentTarget)}
            >
              View details
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}
