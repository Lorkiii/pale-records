// Renders Attendance selection, date controls, compact toolbar actions, totals, and feedback.
import type { ReactNode } from 'react';
import { ActionIconButton } from '../../../components/ui/ActionIconButton';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Notice } from '../../../components/ui/Notice';
import { Select } from '../../../components/ui/Select';
import type { ClassRecord } from '../../classes/class-types';
import type { AttendanceStatusCounts } from '../attendance-draft';
import {
  formatAttendanceDateLong,
  formatAttendanceSessionSchedule,
} from '../attendance-draft';
import type { AttendanceSessionDraft } from '../attendance-types';
import type {
  DateFormatPreference,
  TimeFormatPreference,
} from '../../settings/preference-display';

export interface AttendanceToolbarFeedback {
  noticeKey: object;
  variant: 'info' | 'warning' | 'error' | 'success';
  title: string;
  content: ReactNode;
}

interface AttendanceToolbarProps {
  classes: ClassRecord[];
  selectedClassId: string;
  monthInput: string;
  dateInput: string;
  selectedDate: string | null;
  selectedSession: AttendanceSessionDraft | null;
  prevSessionId?: string | null;
  nextSessionId?: string | null;
  sessionPositionLabel?: string;
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  isBusy: boolean;
  isCreating: boolean;
  isSaving: boolean;
  canUndo: boolean;
  canImport: boolean;
  canExportTemplate: boolean;
  canAddDate: boolean;
  canGenerateMissingDates: boolean;
  missingScheduledDates: string[];
  isFillingDates: boolean;
  dateHint: string;
  statusCounts: AttendanceStatusCounts;
  feedback: AttendanceToolbarFeedback | null;
  dateFormat?: DateFormatPreference;
  timeFormat?: TimeFormatPreference;
  onClassChange: (classId: string) => void;
  onMonthInputChange: (month: string) => void;
  onDateInputChange: (date: string) => void;
  onAddDate: () => void;
  onGenerateMissingDates: () => void;
  onSelectPrevSession?: () => void;
  onSelectNextSession?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onImport: () => void;
  onExportTemplate: () => void;
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
  monthInput,
  dateInput,
  selectedDate,
  selectedSession,
  prevSessionId,
  nextSessionId,
  sessionPositionLabel,
  isEditing,
  hasUnsavedChanges,
  isBusy,
  isCreating,
  isSaving,
  canUndo,
  canImport,
  canExportTemplate,
  canAddDate,
  canGenerateMissingDates,
  missingScheduledDates,
  isFillingDates,
  dateHint,
  statusCounts,
  feedback,
  dateFormat,
  timeFormat,
  onClassChange,
  onMonthInputChange,
  onDateInputChange,
  onAddDate,
  onGenerateMissingDates,
  onSelectPrevSession,
  onSelectNextSession,
  onEdit,
  onDelete,
  onImport,
  onExportTemplate,
  onMarkUnmarkedPresent,
  onUndo,
  onCancel,
  onSave,
}: AttendanceToolbarProps) {
  return (
    <section className="space-y-3 sm:space-y-4" aria-labelledby="attendance-controls-heading">
      <div className="border border-ink bg-paper-light">
        <div className="border-b border-ink bg-paper-muted px-3 py-2 sm:px-4 sm:py-3">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            03 / Register controls
          </p>
          <h2 id="attendance-controls-heading" className="mt-1 font-display text-xl font-semibold tracking-[-0.03em] text-ink">
            Select a roster and attendance date
          </h2>
        </div>

        <div className="grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(11rem,0.65fr)_minmax(12rem,0.75fr)_auto] lg:items-end">
          <Select
            id="attendance-class"
            label="Class"
            value={selectedClassId}
            disabled={isBusy}
            onChange={(event) => onClassChange(event.target.value)}
            options={[
              { value: '', label: 'Select a class' },
              ...classes.map((classRecord) => ({
                value: classRecord.id,
                label: getClassOptionLabel(classRecord),
              })),
            ]}
            hint="Saved sessions and roster snapshots are kept separately for each class."
          />

          <Input
            id="attendance-month"
            type="month"
            label="Calendar month"
            value={monthInput}
            disabled={isBusy || hasUnsavedChanges}
            min="2000-01"
            max="2100-12"
            onChange={(event) => onMonthInputChange(event.target.value)}
            hint="Scheduled dates are created when you open a class month. Fill later schedule gaps below."
          />

          <Input
            id="attendance-date"
            type="date"
            label="Attendance date"
            value={dateInput}
            disabled={isBusy}
            onChange={(event) => onDateInputChange(event.target.value)}
            hint={dateHint}
          />

          <Button
            onClick={onAddDate}
            disabled={!canAddDate}
            className="w-full lg:w-auto"
          >
            {isCreating ? 'Adding date…' : 'Add date'}
          </Button>
        </div>

        {missingScheduledDates.length > 0 ? (
          <div className="border-t border-paper-border px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
                  {missingScheduledDates.length} missing weekly {missingScheduledDates.length === 1 ? 'date' : 'dates'}
                </p>
                <p className="mt-1 text-sm text-ink-secondary">
                  Current weekly rules include these dates. Some may have been deleted earlier; generating will add them again. Existing attendance stays unchanged.
                </p>
                {hasUnsavedChanges ? (
                  <p className="mt-1 text-sm font-semibold text-ink">Save or cancel attendance edits to generate dates.</p>
                ) : null}
                <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Scheduled attendance dates to create">
                  {missingScheduledDates.map((date) => (
                    <li key={date} className="border border-paper-dark bg-paper px-2 py-1 text-xs text-ink">
                      {formatAttendanceDateLong(date, dateFormat)}
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={onGenerateMissingDates}
                disabled={!canGenerateMissingDates}
                isLoading={isFillingDates}
                className="w-full shrink-0 sm:w-auto"
              >
                Generate missing dates
              </Button>
            </div>
          </div>
        ) : null}

        {selectedDate ? (
          <div className="border-t border-paper-border px-3 py-2 sm:px-4 sm:py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                {sessionPositionLabel ? (
                  <div className="flex shrink-0 items-center border border-ink bg-paper">
                    <ActionIconButton
                      icon="chevron-left"
                      label="Previous attendance date"
                      tooltip={prevSessionId ? 'Previous attendance date' : 'At earliest attendance date'}
                      variant="ghost"
                      onClick={onSelectPrevSession}
                      disabled={!prevSessionId || isBusy}
                    />
                    <span
                      className="min-w-[4.5rem] px-2 text-center font-mono text-[11px] font-bold tracking-wider text-ink"
                      aria-label={`Attendance date ${sessionPositionLabel}`}
                    >
                      {sessionPositionLabel}
                    </span>
                    <ActionIconButton
                      icon="chevron-right"
                      label="Next attendance date"
                      tooltip={nextSessionId ? 'Next attendance date' : 'At latest attendance date'}
                      variant="ghost"
                      onClick={onSelectNextSession}
                      disabled={!nextSessionId || isBusy}
                    />
                  </div>
                ) : null}

                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                    Selected date
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">
                      {formatAttendanceDateLong(selectedDate, dateFormat)}
                    </p>
                    <span className="border border-ink bg-paper-muted px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink">
                      {isEditing ? 'Editing' : 'Read-only'}
                    </span>
                    {selectedSession && !selectedSession.isRosterInitialized ? (
                      <span className="border border-signal-blue bg-paper-light px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-signal-blue">
                        Draft
                      </span>
                    ) : null}
                    {hasUnsavedChanges ? (
                      <span className="border border-signal-amber bg-paper-light px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink">
                        Unsaved
                      </span>
                    ) : null}
                    {selectedSession ? (
                      <span className="hidden border border-paper-dark bg-paper-light px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-secondary sm:inline-block">
                        {formatAttendanceSessionSchedule(selectedSession, timeFormat)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:gap-3 lg:self-center">
                <div className="flex items-center gap-1.5 border border-paper-border bg-paper p-1">
                  <ActionIconButton
                    icon="print"
                    label="Print template"
                    tooltip={canExportTemplate
                      ? 'Print attendance template for this date'
                      : 'Attendance date with enrolled students required'}
                    variant="secondary"
                    aria-haspopup="dialog"
                    onClick={onExportTemplate}
                    disabled={!canExportTemplate || isBusy}
                  />

                  {isEditing ? (
                    <>
                      <ActionIconButton
                        icon="import"
                        label="Import attendance"
                        tooltip={canImport
                          ? 'Import attendance (CSV / PALE template)'
                          : 'Import requires a clean editable roster'}
                        variant="secondary"
                        aria-haspopup="dialog"
                        onClick={onImport}
                        disabled={!canImport || isBusy}
                      />
                      <ActionIconButton
                        icon="mark-all"
                        label="Mark unmarked as Present"
                        tooltip="Quick-fill: Mark all unmarked students as Present (P)"
                        variant="secondary"
                        onClick={onMarkUnmarkedPresent}
                        disabled={isBusy}
                      />
                      <ActionIconButton
                        icon="undo"
                        label="Undo last change"
                        tooltip={canUndo ? 'Undo last attendance change' : 'No actions to undo'}
                        variant="ghost"
                        onClick={onUndo}
                        disabled={!canUndo || isBusy}
                      />
                    </>
                  ) : null}
                </div>

                <div className="flex items-center gap-1.5 border border-paper-border bg-paper p-1">
                  {isEditing ? (
                    <>
                      <ActionIconButton
                        icon="cancel"
                        label="Cancel changes"
                        tooltip="Cancel unsaved changes and revert to saved"
                        variant="secondary"
                        onClick={onCancel}
                        disabled={isBusy}
                      />
                      <ActionIconButton
                        icon="save"
                        label={isSaving ? 'Saving attendance' : 'Save attendance'}
                        tooltip={isSaving ? 'Saving attendance…' : 'Save attendance to class records'}
                        isLoading={isSaving}
                        variant="primary"
                        onClick={onSave}
                        disabled={isBusy}
                      />
                    </>
                  ) : (
                    <>
                      <ActionIconButton
                        icon="delete"
                        label="Delete date"
                        tooltip="Delete this attendance date and its records"
                        variant="destructive"
                        onClick={onDelete}
                        disabled={isBusy}
                      />
                      <ActionIconButton
                        icon="edit"
                        label="Edit attendance"
                        tooltip="Edit attendance records for this date"
                        variant="primary"
                        onClick={onEdit}
                        disabled={isBusy}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Notice variant="info" title="How attendance is saved" collapsible>
        Dates are saved when you create them. Select Save attendance to save a date’s roster and marks for the first time. Later enrollment changes do not change that saved roster.
      </Notice>

      {feedback ? (
        <Notice variant={feedback.variant} title={feedback.title} collapsible noticeKey={feedback.noticeKey}>
          {feedback.content}
        </Notice>
      ) : null}

      {selectedDate ? (
        <div className="grid gap-px border border-ink bg-ink sm:grid-cols-5" aria-label="Attendance summary">
          {SUMMARY_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3 bg-paper-light px-3 py-2">
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

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-y border-paper-border bg-paper-light px-3 py-2" aria-label="Attendance status legend">
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
