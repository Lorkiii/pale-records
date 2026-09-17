// Shows one saved student's identity and class assignments with optional active-record actions.
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import type { StudentRecord } from '../student-types';

interface StudentDetailsDialogProps {
  student: StudentRecord;
  canEdit?: boolean;
  onClose: () => void;
  onEdit?: (student: StudentRecord) => void;
  onArchive?: (student: StudentRecord) => void;
  archived?: boolean;
}

export function StudentDetailsDialog({
  student,
  canEdit,
  onClose,
  onEdit,
  onArchive,
  archived = false,
}: StudentDetailsDialogProps) {
  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Student details"
      description={`${student.lastName}, ${student.firstName}`}
      footer={onEdit && onArchive ? (
        <>
          <Button variant="destructive" onClick={() => onArchive(student)}>
            Archive
          </Button>
          <Button onClick={() => onEdit(student)} disabled={!canEdit}>
            Edit student
          </Button>
        </>
      ) : undefined}
    >
      <dl className="grid gap-px border border-ink bg-ink sm:grid-cols-2">
        <div className="min-w-0 bg-paper-light p-4">
          <dt className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">Full name</dt>
          <dd className="mt-1 break-words text-base font-semibold text-ink">
            {student.firstName} {student.lastName}
          </dd>
        </div>
        <div className="min-w-0 bg-paper-light p-4">
          <dt className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">Student number</dt>
          <dd className="mt-1 break-all font-mono text-sm text-ink-secondary">
            {student.studentNo ?? 'Not provided'}
          </dd>
        </div>
      </dl>

      <section className="mt-5" aria-labelledby="student-details-classes-heading">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-ink pb-2">
          <h3 id="student-details-classes-heading" className="font-display text-lg font-semibold text-ink">
            Enrolled classes
          </h3>
          <span className="font-mono text-xs text-ink-secondary">
            {student.classes.length} {student.classes.length === 1 ? 'class' : 'classes'}
          </span>
        </div>
        <ul className="divide-y divide-paper-border">
          {student.classes.map((classRecord) => (
            <li key={classRecord.id} className="py-3">
              <p className="break-words text-sm font-semibold text-ink">{classRecord.subjectName}</p>
              {[classRecord.subjectCode, classRecord.section].some(Boolean) ? (
                <p className="mt-1 break-words font-mono text-xs text-ink-secondary">
                  {[classRecord.subjectCode, classRecord.section].filter(Boolean).join(' / ')}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {student.classes.length === 0 ? (
          <p className="py-3 text-sm text-ink-secondary">
            {archived ? 'No classes assigned.' : 'No active classes assigned.'}
          </p>
        ) : null}
      </section>
    </Dialog>
  );
}
