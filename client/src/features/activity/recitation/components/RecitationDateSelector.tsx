// Renders one month of Recitation dates for direct local multi-selection.
import {
  formatRecitationDateLong,
  getRecitationMonthParts,
} from '../recitation-draft';

interface RecitationDateSelectorProps {
  monthInput: string;
  selectedDates: string[];
  existingDates: string[];
  isSelectionAvailable: boolean;
  isBusy: boolean;
  onToggleDate: (date: string) => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Builds a date-only value without converting it through UTC.
function getDateValue(year: number, month: number, day: number) {
  const yearValue = year.toString().padStart(4, '0');
  const monthValue = month.toString().padStart(2, '0');
  const dayValue = day.toString().padStart(2, '0');
  return `${yearValue}-${monthValue}-${dayValue}`;
}

// Keeps the calendar grid aligned to the browser's local calendar.
function getMonthDays(year: number, month: number) {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const calendarCellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  return Array.from({ length: calendarCellCount }, (_, index) =>
    index < firstWeekday || index >= firstWeekday + daysInMonth
      ? null
      : index - firstWeekday + 1,
  );
}

// Presents selectable, selected, and existing dates without relying on color alone.
export function RecitationDateSelector({
  monthInput,
  selectedDates,
  existingDates,
  isSelectionAvailable,
  isBusy,
  onToggleDate,
}: RecitationDateSelectorProps) {
  const month = getRecitationMonthParts(monthInput);
  const selectedDateSet = new Set(selectedDates);
  const existingDateSet = new Set(existingDates);

  if (!month) {
    return null;
  }

  const calendarDays = getMonthDays(month.year, month.month);
  const calendarMonthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(month.year, month.month - 1, 1));

  return (
    <section aria-labelledby="recitation-date-selector-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Select Recitation dates
          </p>
          <h3
            id="recitation-date-selector-heading"
            className="mt-1 font-display text-lg font-semibold tracking-[-0.02em] text-ink"
          >
            {calendarMonthLabel}
          </h3>
          <p className="mt-1 text-sm leading-6 text-ink-secondary">
            Select available dates. Existing dates are already in the register.
          </p>
        </div>
        <p className="border border-paper-dark bg-paper-muted px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-secondary">
          {selectedDates.length} selected
        </p>
      </div>

      <div
        className="mt-4 grid grid-cols-7 gap-px border border-ink bg-ink"
        role="group"
        aria-label="Recitation date calendar"
      >
        {WEEKDAY_LABELS.map((weekday) => (
          <div
            key={weekday}
            className="bg-paper-muted px-1 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-secondary sm:text-[11px]"
          >
            <span aria-hidden="true">{weekday.slice(0, 1)}</span>
            <span className="sr-only">{weekday}</span>
          </div>
        ))}

        {calendarDays.map((day, index) => {
          if (day === null) {
            return (
              <div
                key={`blank-${index}`}
                className="min-h-14 bg-paper-light sm:min-h-16"
                aria-hidden="true"
              />
            );
          }

          const date = getDateValue(month.year, month.month, day);
          const isExisting = existingDateSet.has(date);
          const isSelected = selectedDateSet.has(date);
          const isUnavailable = !isSelectionAvailable || isBusy;
          const dateLabel = formatRecitationDateLong(date);
          const stateLabel = isExisting
            ? 'Existing Recitation date.'
            : isSelected
              ? 'Selected. Activate to remove from selected dates.'
              : isUnavailable
                ? 'Unavailable while the Recitation workspace is busy or has unsaved changes.'
                : 'Available. Activate to select.';
          const stateText = isExisting
            ? 'Existing'
            : isSelected
              ? 'Selected'
              : isUnavailable
                ? 'Unavailable'
                : 'Available';
          const stateClassName = isExisting
            ? 'border-paper-dark bg-paper-muted text-ink-secondary'
            : isSelected
              ? 'border-ink bg-ink text-paper-light'
              : isUnavailable
                ? 'border-paper-dark bg-paper-muted text-ink-muted'
                : 'border-paper-border bg-paper-light text-ink hover:border-ink hover:bg-paper-muted';

          return (
            <button
              key={date}
              type="button"
              aria-label={`${dateLabel}. ${stateLabel}`}
              aria-pressed={isExisting ? undefined : isSelected}
              disabled={isExisting || isUnavailable}
              onClick={() => onToggleDate(date)}
              className={`flex min-h-14 w-full flex-col items-center justify-center border px-1 py-1.5 font-mono text-sm font-bold transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink disabled:cursor-not-allowed sm:min-h-16 ${stateClassName}`}
            >
              <span>{day}</span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] sm:text-[10px]">
                {stateText}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
