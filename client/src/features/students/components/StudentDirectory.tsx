// Renders each persisted student once with every enrolled class.
import type { StudentRecord } from '../student-types';

interface StudentDirectoryProps {
  students: StudentRecord[];
}

// Presents students as responsive rows that remain readable without horizontal scrolling.
export function StudentDirectory({ students }: StudentDirectoryProps) {
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
            className="grid gap-5 border-b border-paper-border p-5 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1.4fr)] sm:items-start sm:gap-6"
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
              <ul className="mt-1 space-y-2">
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
          </li>
        ))}
      </ol>
    </section>
  );
}
