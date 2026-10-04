// Renders the calendar with class/category accents, completion, and labeled session markers.
import type { ClassRecord } from '../../classes/class-types';
import { formatAgendaClassLabel, getAgendaClassColor } from '../agenda-class-colors';
import { AGENDA_CATEGORY_ACCENTS, type CalendarDayCell } from '../agenda-types';
import { DAYS_OF_WEEK_SHORT } from '../agenda-utils';
import {
  formatDateOnly,
  formatTime,
  getTableDensityClasses,
  type DateFormatPreference,
  type TableDensityPreference,
  type TimeFormatPreference,
} from '../../settings/preference-display';

interface AgendaCalendarGridProps {
  cells: CalendarDayCell[];
  classes: ClassRecord[];
  dateFormat?: DateFormatPreference;
  timeFormat?: TimeFormatPreference;
  tableDensity?: TableDensityPreference;
  onSelectDate: (dateKey: string) => void;
}

export function AgendaCalendarGrid({
  cells,
  classes,
  dateFormat,
  timeFormat,
  tableDensity,
  onSelectDate,
}: AgendaCalendarGridProps) {
  const density = getTableDensityClasses(tableDensity);
  const classMap = new Map(classes.map((classRecord) => [classRecord.id, classRecord]));

  return (
    <div className="max-w-full overflow-x-auto">
    <div className="flex min-w-[21rem] flex-col border border-ink bg-paper-light sm:min-w-0">
      {/* Weekday Column Headers */}
      <div className="grid grid-cols-7 border-b border-ink bg-paper-muted text-center font-mono text-xs font-bold uppercase tracking-[0.14em] text-ink">
        {DAYS_OF_WEEK_SHORT.map((day) => (
          <div key={day} className="border-r border-ink/40 py-2.5 last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, index) => {
          const isRightEdge = (index + 1) % 7 === 0;
          const isBottomEdge = index >= cells.length - 7;

          const totalItemsCount = cell.events.length + cell.syncedSessions.length;
          const itemDescriptions = [
            ...cell.events.map((event) => {
              const linkedClass = event.classId ? classMap.get(event.classId) : undefined;
              return `${event.title} (${event.category.name})${linkedClass ? `, ${formatAgendaClassLabel(linkedClass)}` : ''}${event.completedAt ? ', completed' : ''}`;
            }),
            ...cell.syncedSessions.map((session) =>
              `${formatAgendaClassLabel(session)}, ${formatTime(session.startTime, timeFormat)}–${formatTime(session.endTime, timeFormat)}`,
            ),
          ];

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => onSelectDate(cell.dateKey)}
              aria-label={`${formatDateOnly(cell.dateKey, dateFormat)}, ${totalItemsCount} scheduled items${itemDescriptions.length > 0 ? `: ${itemDescriptions.join('; ')}` : ''}`}
              className={`group relative flex flex-col justify-between text-left transition-colors cursor-pointer select-none focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ink ${density.calendarCell} ${
                !isRightEdge ? 'border-r border-paper-border' : ''
              } ${!isBottomEdge ? 'border-b border-paper-border' : ''} ${
                cell.isSelected
                  ? 'bg-paper-muted ring-2 ring-inset ring-ink'
                  : cell.isCurrentMonth
                    ? 'bg-paper-light hover:bg-paper'
                    : 'bg-paper-muted/30 text-ink-faint hover:bg-paper-muted/50'
              }`}
            >
              {/* Day Number and Badges */}
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`font-mono text-xs sm:text-sm font-semibold transition-transform group-hover:scale-105 ${
                    cell.isToday
                      ? 'bg-ink px-1.5 py-0.5 font-bold text-paper-light'
                      : cell.isSelected
                        ? 'font-bold text-ink'
                        : cell.isCurrentMonth
                          ? 'text-ink'
                          : 'text-ink-faint'
                  }`}
                >
                  {String(cell.dayNumber).padStart(2, '0')}
                </span>

                {/* Event Count Pip if crowded on mobile */}
                {totalItemsCount > 0 && (
                  <span className="font-mono text-[10px] font-bold text-ink-muted sm:hidden">
                    •{totalItemsCount}
                  </span>
                )}
              </div>

              {/* Event Previews (Desktop / Tablet) */}
              <div className="mt-1 hidden flex-1 flex-col gap-1 overflow-hidden sm:flex">
                {/* Custom Events */}
                {cell.events.slice(0, 2).map((evt) => {
                  const accent = AGENDA_CATEGORY_ACCENTS[evt.category.accentKey];
                  const linkedClass = evt.classId ? classMap.get(evt.classId) : undefined;
                  const classColor = linkedClass ? getAgendaClassColor(linkedClass.id) : undefined;
                  return (
                    <div
                      key={evt.id}
                      className={`flex items-center gap-1 truncate border px-1 py-0.5 text-[10px] font-mono leading-tight font-medium ${classColor ? `${classColor.surfaceStyle} text-ink` : accent.badgeStyle} ${
                        evt.completedAt ? 'opacity-60 line-through' : ''
                      }`}
                      title={`${evt.title} (${evt.category.name})${linkedClass ? ` — ${formatAgendaClassLabel(linkedClass)}` : ''}${evt.completedAt ? ' — Completed' : ''}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 shrink-0 ${classColor ? `border border-ink/60 ${classColor.pipColor}` : `rounded-full ${accent.pipColor}`}`}
                      />
                      <span className="truncate">{evt.title}</span>
                    </div>
                  );
                })}

                {/* Synced Class Sessions */}
                {cell.syncedSessions.slice(0, 2 - Math.min(cell.events.length, 2)).map((session) => {
                  const classColor = getAgendaClassColor(session.classId);
                  return (
                    <div
                      key={session.id}
                      className={`flex items-center gap-1 truncate border border-dashed px-1 py-0.5 font-mono text-[10px] text-ink ${classColor.surfaceStyle}`}
                      title={`${formatAgendaClassLabel(session)} (${formatTime(session.startTime, timeFormat)}–${formatTime(session.endTime, timeFormat)})`}
                    >
                      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 border border-ink/60 ${classColor.pipColor}`} />
                      <span className="truncate">
                        {session.subjectCode ?? session.subjectName}{session.section ? ` · ${session.section}` : ''}
                      </span>
                    </div>
                  );
                })}

                {/* More items indicator */}
                {totalItemsCount > 2 && (
                  <div className="font-mono text-[9px] font-semibold text-ink-muted">
                    +{totalItemsCount - 2} more
                  </div>
                )}
              </div>

              {/* Mobile pip dots */}
              <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                {cell.events.slice(0, 3).map((evt) => {
                  const accent = AGENDA_CATEGORY_ACCENTS[evt.category.accentKey];
                  const linkedClass = evt.classId ? classMap.get(evt.classId) : undefined;
                  const classColor = linkedClass ? getAgendaClassColor(linkedClass.id) : undefined;
                  return (
                    <span
                      key={evt.id}
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 ${classColor ? `border border-ink/60 ${classColor.pipColor}` : `rounded-full ${accent.pipColor}`} ${evt.completedAt ? 'opacity-40' : ''}`}
                    />
                  );
                })}
                {cell.syncedSessions.slice(0, 3).map((session) => (
                  <span
                    key={session.id}
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 border border-ink/60 ${getAgendaClassColor(session.classId).pipColor}`}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
    </div>
  );
}
