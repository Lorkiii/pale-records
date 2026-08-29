// Renders Recitation selectors, local date selection, edit actions, and feedback.
import type { ReactNode } from 'react';
import { ActionIconButton } from '../../../../components/ui/ActionIconButton';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Notice } from '../../../../components/ui/Notice';
import { Select } from '../../../../components/ui/Select';
import type { ClassRecord } from '../../../classes/class-types';
import {
  formatRecitationDateLong,
  type RecitationMarkCounts,
} from '../recitation-draft';
import type { RecitationSessionDraft } from '../recitation-types';
import { RecitationDateSelector } from './RecitationDateSelector';

export interface RecitationToolbarFeedback {
  variant: 'info' | 'warning' | 'error' | 'success';
  title: string;
  content: ReactNode;
}

interface RecitationToolbarProps {
  classes: ClassRecord[];
  selectedClassId: string;
  monthInput: string;
  selectedDates: string[];
  pendingDateCount: number;
  existingDates: string[];
  selectedDate: string | null;
  selectedSession: RecitationSessionDraft | null;
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  isBusy: boolean;
  isCreating: boolean;
  isSaving: boolean;
  canUndo: boolean;
  canSelectDates: boolean;
  canAddDates: boolean;
  markCounts: RecitationMarkCounts;
  feedback: RecitationToolbarFeedback | null;
  onClassChange: (classId: string) => void;
  onMonthInputChange: (month: string) => void;
  onToggleSelectedDate: (date: string) => void;
  onRemoveSelectedDate: (date: string) => void;
  onClearSelectedDates: () => void;
  onAddDates: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onCancel: () => void;
  onSave: () => void;
}

const SUMMARY_ITEMS: Array<{
  key: keyof RecitationMarkCounts;
  symbol: string;
  label: string;
  markerClassName: string;
}> = [
  {
    key: 'CHECK',
    symbol: '✓',
    label: 'Check',
    markerClassName: 'border-signal-emerald text-signal-emerald',
  },
  {
    key: 'X',
    symbol: 'X',
    label: 'X',
    markerClassName: 'border-signal-red text-signal-red',
  },
  {
    key: 'unmarked',
    symbol: '—',
    label: 'Unmarked',
    markerClassName: 'border-paper-dark text-ink-secondary',
  },
];

// Builds a concise selector label from only public active-class fields.
function getClassOptionLabel(classRecord: ClassRecord) {
  const identity = classRecord.subjectCode
    ? `${classRecord.subjectCode} — ${classRecord.subjectName}`
    : classRecord.subjectName;
  return classRecord.section ? `${identity} / ${classRecord.section}` : identity;
}

// Composes register controls without owning Recitation state or requests.
export function RecitationToolbar({
  classes,
  selectedClassId,
  monthInput,
  selectedDates,
  pendingDateCount,
  existingDates,
  selectedDate,
  selectedSession,
  isEditing,
  hasUnsavedChanges,
  isBusy,
  isCreating,
  isSaving,
  canUndo,
  canSelectDates,
  canAddDates,
  markCounts,
  feedback,
  onClassChange,
  onMonthInputChange,
  onToggleSelectedDate,
  onRemoveSelectedDate,
  onClearSelectedDates,
  onAddDates,
  onEdit,
  onDelete,
  onUndo,
  onCancel,
  onSave,
}: RecitationToolbarProps) {
  return (
    <section className="space-y-5" aria-labelledby="recitation-controls-heading">
      <div className="border border-ink bg-paper-light">
        <div className="border-b border-ink bg-paper-muted px-4 py-3 sm:px-5">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            04 / Recitation controls
          </p>
          <h2
            id="recitation-controls-heading"
            className="mt-1 font-display text-xl font-semibold tracking-[-0.03em] text-ink"
          >
            Recitation register
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-secondary">
            Select a class and month, then choose the Recitation dates to add.
          </p>
        </div>

        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(11rem,0.65fr)] lg:items-end">
          <Select
            id="recitation-class"
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
            hint="Subject, section, and enrollment come from the selected class."
          />

          <Input
            id="recitation-month"
            type="month"
            label="Calendar month"
            value={monthInput}
            disabled={isBusy}
            min="2000-01"
            max="2100-12"
            onChange={(event) => onMonthInputChange(event.target.value)}
            hint="Loads only this class month."
          />
        </div>

        <div className="border-t border-paper-border px-4 py-4 sm:px-5">
          <RecitationDateSelector
            monthInput={monthInput}
            selectedDates={selectedDates}
            existingDates={existingDates}
            isSelectionAvailable={canSelectDates}
            isBusy={isBusy}
            onToggleDate={onToggleSelectedDate}
          />

          {selectedDates.length > 0 ? (
            <div className="mt-5 border-t border-paper-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p
                    id="selected-recitation-dates-heading"
                    className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted"
                  >
                    Selected dates / {selectedDates.length}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-ink-secondary">
                    These dates stay local until you add them.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onClearSelectedDates}
                  disabled={isBusy}
                >
                  Clear selected dates
                </Button>
              </div>

              <ul
                className="mt-3 flex flex-wrap gap-2"
                aria-labelledby="selected-recitation-dates-heading"
              >
                {selectedDates.map((date) => (
                  <li
                    key={date}
                    className="flex min-h-11 items-center border border-ink bg-paper-muted pl-3"
                  >
                    <span className="text-sm font-semibold text-ink">
                      {formatRecitationDateLong(date)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${formatRecitationDateLong(date)} from selected Recitation dates`}
                      onClick={() => onRemoveSelectedDate(date)}
                      disabled={isBusy}
                      className="ml-2"
                    >
                      <span aria-hidden="true">×</span>
                    </Button>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-4 w-full sm:w-auto"
                onClick={onAddDates}
                disabled={!canAddDates}
              >
                {isCreating
                  ? 'Adding dates…'
                  : pendingDateCount === 1
                    ? 'Add date'
                    : `Add ${pendingDateCount} dates`}
              </Button>
            </div>
          ) : null}
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
                    {formatRecitationDateLong(selectedDate)}
                  </p>
                  <span className="border border-ink bg-paper-muted px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink">
                    {isEditing ? 'Editing' : 'Read-only'}
                  </span>
                  {selectedSession && !selectedSession.isRosterInitialized ? (
                    <span className="border border-signal-blue bg-paper-light px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-signal-blue">
                      Unsaved roster draft
                    </span>
                  ) : null}
                  {hasUnsavedChanges ? (
                    <span className="border border-signal-amber bg-paper-light px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink">
                      Unsaved changes
                    </span>
                  ) : null}
                </div>
              </div>

              {isEditing ? (
                <div className="flex flex-wrap gap-2">
                  <ActionIconButton
                    icon="delete"
                    label="Delete Recitation"
                    tooltip="Delete Recitation"
                    variant="destructive"
                    onClick={onDelete}
                    disabled={isBusy}
                  />
                  <Button variant="ghost" onClick={onUndo} disabled={!canUndo || isBusy}>
                    Undo last change
                  </Button>
                  <ActionIconButton
                    icon="cancel"
                    label="Cancel changes"
                    tooltip="Cancel changes"
                    variant="secondary"
                    onClick={onCancel}
                    disabled={isBusy}
                  />
                  <ActionIconButton
                    icon="save"
                    label={isSaving ? 'Saving Recitation' : 'Save Recitation'}
                    tooltip={isSaving ? 'Saving Recitation' : 'Save Recitation'}
                    isLoading={isSaving}
                    onClick={onSave}
                    disabled={isBusy}
                  />
                </div>
              ) : (
                <ActionIconButton
                  icon="edit"
                  label="Edit Recitation"
                  tooltip="Edit Recitation"
                  variant="secondary"
                  onClick={onEdit}
                  disabled={isBusy}
                />
              )}
            </div>
          </div>
        ) : null}
      </div>

      <Notice variant="info" title="Recitation storage">
        Selected dates remain local until Add dates is selected. Created dates use an unpersisted Unmarked roster until the first Save Recitation captures the complete historical roster; later enrollment changes do not rewrite it.
      </Notice>

      {feedback ? (
        <Notice variant={feedback.variant} title={feedback.title}>
          {feedback.content}
        </Notice>
      ) : null}

      {selectedDate ? (
        <div
          className="grid gap-px border border-ink bg-ink sm:grid-cols-3"
          aria-label="Selected Recitation mark counts"
        >
          {SUMMARY_ITEMS.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-4 bg-paper-light px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center border bg-paper-light font-mono text-sm font-bold ${item.markerClassName}`}
                  aria-hidden="true"
                >
                  {item.symbol}
                </span>
                <span className="truncate text-sm font-semibold text-ink-secondary">
                  {item.label}
                </span>
              </div>
              <span className="font-mono text-lg font-bold tabular-nums text-ink">
                {markCounts[item.key]}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
