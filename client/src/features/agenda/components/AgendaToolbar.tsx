// Provides month navigation, class filtering, category filtering, and event creation triggers.
import { Button } from '../../../components/ui/Button';
import { Select, type SelectOption } from '../../../components/ui/Select';
import type { ClassRecord } from '../../classes/class-types';
import {
  AGENDA_EVENT_TYPES,
  type AgendaTypeFilter,
} from '../agenda-types';
import { formatMonthYearHeader } from '../agenda-utils';

interface AgendaToolbarProps {
  viewYear: number;
  viewMonth: number;
  classes: ClassRecord[];
  selectedClassId: string;
  selectedTypeFilter: AgendaTypeFilter;
  onClassFilterChange: (classId: string) => void;
  onTypeFilterChange: (filter: AgendaTypeFilter) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onAddEventClick: () => void;
}

export function AgendaToolbar({
  viewYear,
  viewMonth,
  classes,
  selectedClassId,
  selectedTypeFilter,
  onClassFilterChange,
  onTypeFilterChange,
  onPrevMonth,
  onNextMonth,
  onToday,
  onAddEventClick,
}: AgendaToolbarProps) {
  const classOptions: SelectOption[] = [
    { value: 'ALL', label: 'All Classes' },
    ...classes.map((cls) => ({
      value: cls.id,
      label: cls.section
        ? `${cls.subjectName} (${cls.section})`
        : cls.subjectCode
          ? `${cls.subjectCode} - ${cls.subjectName}`
          : cls.subjectName,
    })),
  ];

  const typeOptions: SelectOption[] = [
    { value: 'ALL', label: 'All Categories & Sessions' },
    { value: 'CUSTOM_EVENTS', label: 'All Custom Events' },
    { value: 'CLASS_SESSIONS', label: 'Class Schedules Only' },
    ...AGENDA_EVENT_TYPES.map((t) => ({
      value: t.type,
      label: t.label,
    })),
  ];

  return (
    <div className="flex flex-col gap-4 border-b border-ink bg-paper-light p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
      {/* Month Navigator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center border border-ink bg-paper">
          <button
            type="button"
            aria-label="Previous month"
            onClick={onPrevMonth}
            className="flex h-10 w-10 cursor-pointer items-center justify-center border-r border-ink font-mono text-sm text-ink transition-colors hover:bg-paper-muted active:bg-paper-dark"
          >
            ◀
          </button>
          <div className="min-w-[170px] px-4 text-center font-display text-base font-bold tracking-tight text-ink sm:text-lg">
            {formatMonthYearHeader(viewYear, viewMonth)}
          </div>
          <button
            type="button"
            aria-label="Next month"
            onClick={onNextMonth}
            className="flex h-10 w-10 cursor-pointer items-center justify-center border-l border-ink font-mono text-sm text-ink transition-colors hover:bg-paper-muted active:bg-paper-dark"
          >
            ▶
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          className="h-10 text-xs"
        >
          Today
        </Button>
      </div>

      {/* Filters & Add Action */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-56">
          <Select
            size="sm"
            value={selectedClassId}
            onChange={(e) => onClassFilterChange(e.target.value)}
            options={classOptions}
            aria-label="Filter events by class"
          />
        </div>

        <div className="w-full sm:w-52">
          <Select
            size="sm"
            value={selectedTypeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value as AgendaTypeFilter)}
            options={typeOptions}
            aria-label="Filter events by category"
          />
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={onAddEventClick}
          className="h-10 shrink-0"
          leftIcon={<span className="font-mono text-base font-normal leading-none">+</span>}
        >
          Add Event
        </Button>
      </div>
    </div>
  );
}
