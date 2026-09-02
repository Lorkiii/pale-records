// Renders compact high-level academic KPI metric cards for the PALE overview dashboard.
import type { DashboardKpiItem } from '../dashboard-types';

interface DashboardKpiGridProps {
  kpis: DashboardKpiItem[];
}

export function DashboardKpiGrid({ kpis }: DashboardKpiGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {kpis.map((kpi, index) => {
        const letter = String.fromCharCode(65 + index); // A, B, C
        return (
          <div
            key={kpi.id}
            className="relative flex flex-col justify-between border border-ink bg-paper-light p-3.5 transition-colors hover:border-black"
          >
            {/* Corner crosshairs */}
            <span className="pointer-events-none absolute -top-1.5 -left-1.5 select-none font-mono text-[9px] font-bold leading-none text-ink">
              +
            </span>
            <span className="pointer-events-none absolute -top-1.5 -right-1.5 select-none font-mono text-[9px] font-bold leading-none text-ink">
              +
            </span>

            <div>
              <div className="flex items-center justify-between border-b border-paper-border pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="bg-ink px-1.5 py-0.2 font-mono text-[10px] font-bold text-paper-light">
                    {letter}
                  </span>
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                    {kpi.label}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-ink-faint">{kpi.code}</span>
              </div>

              <div className="mt-2.5 flex items-baseline justify-between gap-2">
                <p className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  {kpi.value}
                </p>
                {kpi.change ? (
                  <span className="inline-flex items-center gap-1 border border-paper-border bg-paper-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-secondary">
                    {kpi.changeType === 'positive' && (
                      <span className="text-signal-emerald" aria-hidden="true">
                        ↑
                      </span>
                    )}
                    <span>{kpi.change}</span>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-2 border-t border-paper-border pt-1.5">
              <p className="font-sans text-[11px] leading-4 text-ink-muted truncate">{kpi.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
