// Identifies active classes with the same color accents used by Agenda items.
import type { ClassRecord } from '../../classes/class-types';
import { formatAgendaClassLabel, getAgendaClassColor } from '../agenda-class-colors';

interface AgendaClassLegendProps {
  classes: ClassRecord[];
  selectedClassId: string;
}

export function AgendaClassLegend({ classes, selectedClassId }: AgendaClassLegendProps) {
  const legendClasses = selectedClassId === 'ALL'
    ? classes
    : classes.filter((classRecord) => classRecord.id === selectedClassId);

  if (legendClasses.length === 0) return null;

  return (
    <section
      aria-labelledby="agenda-class-legend-heading"
      className="min-w-0 border-b border-ink bg-paper-light px-4 py-4 sm:px-5"
    >
      <h2
        id="agenda-class-legend-heading"
        className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-ink"
      >
        Class legend
      </h2>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2" role="list">
        {legendClasses.map((classRecord) => (
          <li key={classRecord.id} className="flex min-w-0 max-w-full items-start gap-2">
            <span
              aria-hidden="true"
              className={`mt-1 h-3 w-3 shrink-0 border border-ink/60 ${getAgendaClassColor(classRecord.id).pipColor}`}
            />
            <span className="min-w-0 break-words text-sm leading-5 text-ink">
              {formatAgendaClassLabel(classRecord)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
