// Renders and validates the Class form's local weekly schedule rows.
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Notice } from '../../../components/ui/Notice';
import { Select } from '../../../components/ui/Select';
import { CLASS_WEEKDAYS } from '../class-types';
import {
  sortClassScheduleRows,
  type ClassScheduleFormRow,
  type ClassScheduleRowErrors,
} from '../class-schedule-form';

interface ClassScheduleFieldsProps {
  rows: ClassScheduleFormRow[];
  rowErrors: Record<string, ClassScheduleRowErrors>;
  sectionError?: string;
  disabled: boolean;
  onRowsChange: (rows: ClassScheduleFormRow[]) => void;
}

// Composes accessible schedule rows while keeping all values owned by the Class form.
export function ClassScheduleFields({
  rows,
  rowErrors,
  sectionError,
  disabled,
  onRowsChange,
}: ClassScheduleFieldsProps) {
  const selectedWeekdays = new Set(rows.map((row) => row.dayOfWeek).filter(Boolean));

  // Updates one row and reorders it once a valid weekday is available.
  const updateRow = (
    key: string,
    field: 'dayOfWeek' | 'startTime' | 'endTime',
    value: string,
  ) => {
    onRowsChange(sortClassScheduleRows(rows.map((row) =>
      row.key === key ? { ...row, [field]: value } : row,
    )));
  };

  // Adds one stable-keyed blank row without exceeding the weekday limit.
  const addRow = () => {
    if (rows.length < 7) {
      onRowsChange([
        ...rows,
        { key: crypto.randomUUID(), dayOfWeek: '', startTime: '', endTime: '' },
      ]);
    }
  };

  return (
    <fieldset className="border-t border-paper-border pt-5" aria-describedby="class-schedule-help">
      <legend className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
        Weekly schedule
      </legend>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p id="class-schedule-help" className="mt-1 max-w-xl text-sm leading-6 text-ink-muted">
          Add up to one time range per weekday. Times cannot overlap another active class on the same day.
        </p>
        <Button type="button" variant="secondary" onClick={addRow} disabled={disabled || rows.length >= 7}>
          Add schedule day
        </Button>
      </div>

      {sectionError ? (
        <Notice variant="error" title="Weekly schedule needs attention" className="mt-4">
          {sectionError}
        </Notice>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-4 border border-dashed border-paper-dark bg-paper-light px-4 py-4 text-sm text-ink-muted">
          No weekly schedule added.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((row) => {
            const errors = rowErrors[row.key] ?? {};
            return (
              <div key={row.key} className="grid gap-3 border border-paper-border bg-paper-light p-3 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)_auto] sm:items-end">
                <Select
                  id={`class-schedule-day-${row.key}`}
                  label="Weekday"
                  required
                  value={row.dayOfWeek}
                  onChange={(event) => updateRow(row.key, 'dayOfWeek', event.target.value)}
                  disabled={disabled}
                  error={errors.dayOfWeek}
                  options={[
                    { value: '', label: 'Select weekday' },
                    ...CLASS_WEEKDAYS.map((weekday) => ({
                      value: String(weekday.value),
                      label: weekday.label,
                      disabled: row.dayOfWeek !== String(weekday.value) && selectedWeekdays.has(String(weekday.value)),
                    })),
                  ]}
                />
                <Input
                  id={`class-schedule-start-${row.key}`}
                  label="Start time"
                  required
                  type="time"
                  step={60}
                  value={row.startTime}
                  onChange={(event) => updateRow(row.key, 'startTime', event.target.value)}
                  disabled={disabled}
                  error={errors.startTime}
                  isMonospace
                />
                <Input
                  id={`class-schedule-end-${row.key}`}
                  label="End time"
                  required
                  type="time"
                  step={60}
                  value={row.endTime}
                  min={row.startTime || undefined}
                  onChange={(event) => updateRow(row.key, 'endTime', event.target.value)}
                  disabled={disabled}
                  error={errors.endTime}
                  isMonospace
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onRowsChange(rows.filter((candidate) => candidate.key !== row.key))}
                  disabled={disabled}
                  aria-label={`Remove schedule row${row.dayOfWeek ? ` for ${CLASS_WEEKDAYS.find((weekday) => String(weekday.value) === row.dayOfWeek)?.label ?? 'weekday'}` : ''}`}
                >
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
