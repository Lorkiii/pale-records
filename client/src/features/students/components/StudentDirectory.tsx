// Renders page-local student records with their schema fields and assigned class details.
import { useMemo } from 'react';
import type { ClassRecord } from '../../classes/class-types';
import type { StudentRecord } from '../student-types';

interface StudentDirectoryProps {
  students: StudentRecord[];
  classes: ClassRecord[];
}

// Presents student records as responsive rows that remain readable without horizontal scrolling.
export function StudentDirectory({ students, classes }: StudentDirectoryProps) {
  const classesById = useMemo(
    () => new Map(classes.map((classRecord) => [classRecord.id, classRecord])),
    [classes],
  );

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
          {students.length} {students.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      <ol className="border border-ink bg-paper-light">
        {students.map((student, index) => {
          const classRecord = classesById.get(student.classId);
          const classMetadata = [classRecord?.subjectCode, classRecord?.section]
            .filter(Boolean)
            .join(' / ');

          return (
            <li
              key={student.clientId}
              className="grid gap-5 border-b border-paper-border p-5 last:border-b-0 sm:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.25fr)] sm:items-start sm:gap-6"
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
                  Class
                </p>
                <p className="mt-1 break-words text-sm font-medium text-ink-secondary">
                  {classRecord?.subjectName ?? 'Class unavailable'}
                </p>
                {classMetadata ? (
                  <p className="mt-1 break-words font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">
                    {classMetadata}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
