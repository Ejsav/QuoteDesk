"use client";

import { useId, useState } from "react";
import { formatPlainDate, type PlainDate } from "@/domain/dates";
import { Segmented } from "@/components/ui/segmented";
import { cn, formatPercent } from "@/lib/utils";

interface Week {
  weekStart: PlainDate;
  total: number;
  qualified: number;
}

function niceScale(max: number): { top: number; ticks: number[] } {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
  const step = steps.find((s) => Math.ceil(max / s) <= 4) ?? Math.ceil(max / 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return { top, ticks };
}

function weekLabel(week: Week) {
  return formatPlainDate(week.weekStart, "short");
}

/**
 * Weekly inquiry volume, split into inquiries that have reached Qualified and
 * the rest. Bars ≤24px, 4px rounded data-end square at the baseline, 2px
 * surface gap between segments; hover/focus tooltip; table view twin.
 */
export function VolumeChart({ weeks }: { weeks: Week[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [active, setActive] = useState<number | null>(null);
  const liveId = useId();
  const { top, ticks } = niceScale(Math.max(1, ...weeks.map((w) => w.total)));
  const total = weeks.reduce((sum, w) => sum + w.total, 0);
  const qualified = weeks.reduce((sum, w) => sum + w.qualified, 0);
  const activeWeek = active != null ? weeks[active] : null;

  function summary(week: Week, index: number) {
    const name = index === weeks.length - 1 ? "This week so far" : `Week of ${formatPlainDate(week.weekStart, "medium")}`;
    return `${name}: ${week.total} ${week.total === 1 ? "inquiry" : "inquiries"}, ${week.qualified} reached qualified`;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex items-baseline gap-5">
          <div>
            <p className="text-2xl font-semibold tracking-[-0.02em] text-fg">{total}</p>
            <p className="text-xs text-fg-muted">inquiries · 12 weeks</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tracking-[-0.02em] text-fg">{qualified}</p>
            <p className="text-xs text-fg-muted">reached qualified ({formatPercent(total ? qualified / total : null)})</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ul className="flex items-center gap-3 text-xs text-fg-secondary" aria-label="Legend">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-[3px] bg-chart-1" />
              Other inquiries
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-[3px] bg-chart-2" />
              Reached qualified
            </li>
          </ul>
          <Segmented
            size="sm"
            ariaLabel="Display as"
            value={view}
            onChange={setView}
            options={[
              { value: "chart", label: "Chart" },
              { value: "table", label: "Table" },
            ]}
          />
        </div>
      </div>

      {view === "chart" ? (
        <div className="mt-5">
          <div
            role="group"
            tabIndex={0}
            aria-label="Weekly inquiries for the last 12 weeks. Use the left and right arrow keys to read each week."
            aria-describedby={liveId}
            onFocus={() => setActive((a) => a ?? weeks.length - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                setActive((a) => Math.max(0, (a ?? weeks.length) - 1));
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                setActive((a) => Math.min(weeks.length - 1, (a ?? -1) + 1));
              }
            }}
            className="relative rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <div className="relative h-[176px] pl-7">
              {ticks.map((t) => (
                <div key={t} aria-hidden className="absolute right-0 left-7 border-t border-chart-grid" style={{ bottom: `${(t / top) * 100}%` }}>
                  <span className="tabular absolute -left-7 w-5 -translate-y-1/2 text-right text-2xs text-fg-muted">{t}</span>
                </div>
              ))}
              <div className="absolute inset-y-0 right-0 left-7 flex items-end">
                {weeks.map((week, i) => {
                  const segments = [
                    { key: "qualified", value: week.qualified, className: "bg-chart-2" },
                    { key: "other", value: week.total - week.qualified, className: "bg-chart-1" },
                  ].filter((s) => s.value > 0);
                  return (
                    <div
                      key={week.weekStart}
                      className="relative flex h-full flex-1 cursor-default items-end justify-center"
                      onPointerEnter={() => setActive(i)}
                      onPointerLeave={() => setActive(null)}
                    >
                      {week.total > 0 ? (
                        <div
                          className={cn(
                            "flex w-[58%] max-w-[24px] min-w-[8px] flex-col-reverse gap-[2px] transition-opacity duration-150",
                            active != null && active !== i && "opacity-45",
                          )}
                          style={{ height: `${(week.total / top) * 100}%` }}
                        >
                          {segments.map((s, si) => (
                            <div
                              key={s.key}
                              className={cn(s.className, si === segments.length - 1 && "rounded-t-[4px]")}
                              style={{ flexGrow: s.value, flexBasis: 0, minHeight: 2 }}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {activeWeek && active != null ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute z-10 w-max -translate-x-1/2 rounded-lg border border-border bg-surface-raised px-3 py-2 shadow-md"
                  style={{
                    left: `calc(1.75rem + (100% - 1.75rem) * ${(active + 0.5) / weeks.length})`,
                    bottom: `calc(${(activeWeek.total / top) * 100}% + 10px)`,
                  }}
                >
                  <p className="text-2xs font-medium text-fg-muted">
                    {active === weeks.length - 1 ? "This week (so far)" : `Week of ${formatPlainDate(activeWeek.weekStart, "medium")}`}
                  </p>
                  <div className="mt-1 space-y-0.5 text-xs">
                    <p className="flex items-center gap-2">
                      <span className="h-[2px] w-2.5 rounded-full bg-chart-1" />
                      <span className="tabular font-semibold text-fg">{activeWeek.total}</span>
                      <span className="text-fg-muted">inquiries</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="h-[2px] w-2.5 rounded-full bg-chart-2" />
                      <span className="tabular font-semibold text-fg">{activeWeek.qualified}</span>
                      <span className="text-fg-muted">reached qualified</span>
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
            <div aria-hidden className="mt-2 flex pl-7">
              {weeks.map((week, i) => (
                <span
                  key={week.weekStart}
                  className={cn(
                    "flex-1 truncate text-center text-2xs text-fg-muted",
                    i % 2 === 1 && i !== weeks.length - 1 && "hidden sm:block",
                    i === weeks.length - 1 && "font-medium text-fg-secondary",
                    active === i && "text-fg",
                  )}
                >
                  {weekLabel(week)}
                </span>
              ))}
            </div>
          </div>
          <p id={liveId} aria-live="polite" className="sr-only">
            {activeWeek && active != null ? summary(activeWeek, active) : ""}
          </p>
        </div>
      ) : (
        <div className="mt-4 max-h-[236px] overflow-y-auto rounded-lg border border-border-subtle">
          <table className="w-full text-sm">
            <caption className="sr-only">Weekly inquiries for the last 12 weeks</caption>
            <thead className="sticky top-0 bg-surface-sunken text-xs text-fg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Week of
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Inquiries
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Reached qualified
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Share
                </th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-border-subtle">
              {[...weeks].reverse().map((w, i) => (
                <tr key={w.weekStart}>
                  <td className="px-3 py-1.5 text-fg-secondary">{i === 0 ? "This week" : formatPlainDate(w.weekStart, "medium")}</td>
                  <td className="px-3 py-1.5 text-right text-fg">{w.total}</td>
                  <td className="px-3 py-1.5 text-right text-fg">{w.qualified}</td>
                  <td className="px-3 py-1.5 text-right text-fg-muted">{formatPercent(w.total ? w.qualified / w.total : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
