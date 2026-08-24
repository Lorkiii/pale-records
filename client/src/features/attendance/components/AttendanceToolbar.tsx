// Renders attendance selection, page-memory actions, live totals, and status guidance.
import type { ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Notice } from '../../../components/ui/Notice';
import { Select } from '../../../components/ui/Select';
import type { ClassRecord } from '../../classes/class-types';
import type { AttendanceStatusCounts } from '../attendance-draft';
import { formatAttendanceDateLong } from '../attendance-draft';

export interface AttendanceToolbarFeedback {
  variant: 'info' | 'warning' | 'error' | 'success';
  title: string;
  content: ReactNode;
}

interface AttendanceToolbarProps {
  classes: ClassRecord[];
  selectedClassId: string;
  dateInput: string;
  selectedDate: string | null;
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  canUndo: boolean;
  canAddDate: boolean;
  dateHint: string;
  statusCounts: AttendanceStatusCounts;
  feedback: AttendanceToolbarFeedback | null;
  onClassChange: (classId: string) => void;
  onDateInputChange: (date: string) => void;
  onAddDate: () => void;
  onEdit: () => void;
  onMarkUnmarkedPresent: () => void;
  onUndo: () => void;
  onCancel: () => void;
  onSave: () => void;
}

const SUMMARY_ITEMS: Array<{
  key: keyof AttendanceStatusCounts;
  label: string;
  code: string;
  markerClassName: string;
}> = [
  { key: 'P', code: 'P', label: 'Present', markerClassName: 'bg-signal-emerald' },
  { key: 'A', code: 'A', label: 'Absent', markerClassName: 'bg-signal-red' },
  { key: 'L', code: 'L', label: 'Late', markerClassName: 'bg-signal-amber' },
  { key: 'E', code: 'E', label: 'Excused', markerClassName: 'bg-signal-blue' },
  { key: 'unmarked', code: '—', label: 'Unmarked', markerClassName: 'bg-ink-muted' },
];

// Builds a concise option label only from the active class fields returned by the API.
function getClassOptionLabel(classRecord: ClassRecord) {
  const identity = classRecord.subjectCode
    ? `${classRecord.subjectCode} — ${classRecord.subjectName}`
    : classRecord.subjectName;
  return classRecord.section ? `${identity} / ${classRecord.section}` : identity;
}

// Composes the controls around the register without owning attendance state or requests.
export function AttendanceToolbar({
  classes,
  selectedClassId,
  dateInput,
  selectedDate,
  isEditing,
  hasUnsavedChanges,
  canUndo,
  canAddDate,
  dateHint,
  statusCounts,
  feedback,
  onClassChange,
  onDateInputChange,
  onAddDate,
  onEdit,
  onMarkUnmarkedPresent,
  onUndo,
  onCancel,
  onSave,
}: AttendanceToolbarProps) {
  return (
    <section className="space-y-5" aria-labelledby="attendance-controls-heading">
      <div className="border border-ink bg-paper-light">
        <div className="border-b border-ink bg-paper-muted px-4 py-3 sm:px-5">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            03 / Register controls
          </p>
          <h2 id="attendance-controls-heading" className="mt-1 font-display text-xl font-semibold tracking-[-0.03em] text-ink">
            Select a roster and attendance date
          </h2>
        </div>

        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(13rem,0.75fr)_auto] lg:items-end">
          <Select
            id="attendance-class"
            label="Class"
            value={selectedClassId}
            onChange={(event) => onClassChange(event.target.value)}
            options={[
              { value: '', label: 'Select a class' },
              ...classes.map((classRecord) => ({
                value: classRecord.id,
                label: getClassOptionLabel(classRecord),
              })),
            ]}
            hint="Attendance dates are kept separately for each selected class."
          />

          <Input
            id="attendance-date"
            type="date"
            label="Attendance date"
            value={dateInput}
            onChange={(event) => onDateInputChange(event.target.value)}
            hint={dateHint}
          />

          <Button
            onClick={onAddDate}
            disabled={!canAddDate}
            className="w-full lg:w-auto"
          >
            Add date
          </Button>
        </div>

        {selectedDate ? (
          <div className="border-t border-paper-border px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  Selected date
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">
                    {formatAttendanceDateLong(selectedDate)}
                  </p>
                  <span className="border border-ink bg-paper-muted px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink">
                    {isEditing ? 'Editing' : 'Read-only'}
                  </span>
                  {hasUnsavedChanges ? (
                    <span className="border border-signal-amber bg-paper-light px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink">
                      Unsaved changes
                    </span>
                  ) : null}
                </div>
              </div>

              {isEditing ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={onMarkUnmarkedPresent}>
                    Mark unmarked as P
                  </Button>
                  <Button variant="ghost" onClick={onUndo} disabled={!canUndo}>
                    Undo last change
                  </Button>
                  <Button variant="secondary" onClick={onCancel}>
                    Cancel changes
                  </Button>
                  <Button onClick={onSave}>
                    Save attendance
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" onClick={onEdit}>
                  Edit attendance
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <Notice variant="info" title="Page-memory preview">
        This attendance workspace is a UI preview. Attendance, remarks, and selected files remain on this page only and reset on refresh.
      </Notice>

      {feedback ? (
        <Notice variant={feedback.variant} title={feedback.title}>
          {feedback.content}
        </Notice>
      ) : null}

      {selectedDate ? (
        <div className="grid gap-px border border-ink bg-ink sm:grid-cols-5" aria-label="Attendance summary">
          {SUMMARY_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 bg-paper-light px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-3 w-3 shrink-0 border border-ink ${item.markerClassName}`} aria-hidden="true" />
                <span className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-secondary">
                  {item.code} / {item.label}
                </span>
              </div>
              <span className="font-mono text-lg font-bold tabular-nums text-ink">
                {statusCounts[item.key]}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-x-5 gap-y-2 border-y border-paper-border bg-paper-light px-4 py-3" aria-label="Attendance status legend">
        {SUMMARY_ITEMS.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-2 text-sm text-ink-secondary">
            <span className={`h-2.5 w-2.5 border border-ink ${item.markerClassName}`} aria-hidden="true" />
            <span className="font-mono text-xs font-bold text-ink">{item.code}</span>
            <span>{item.label}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
