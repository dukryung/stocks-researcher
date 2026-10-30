import { formatAsOf } from "@/lib/format";
import {
  MACRO_GROUPS,
  MACRO_INDICATORS,
  formatMacroChange,
  formatMacroValue,
  type MacroValue,
} from "@/lib/macro";

const changeClass = (v: MacroValue) => (v.change > 0 ? "text-up" : v.change < 0 ? "text-down" : "text-ink-3");

export default function MacroIndicatorGrid({ values }: { values: Record<string, MacroValue | null> }) {
  return (
    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      {MACRO_GROUPS.map((group) => (
        <div key={group}>
          <h3 className="mb-1 text-xs font-semibold text-ink-3">{group}</h3>
          <dl className="divide-y divide-line">
            {MACRO_INDICATORS.filter((ind) => ind.group === group).map((ind) => {
              const v = values[ind.id];
              return (
                <div key={ind.id} className="flex items-baseline justify-between gap-2 py-1.5 text-sm">
                  <dt className="truncate text-ink-2" title={v ? `${formatAsOf(v.asOf)} (현지)` : undefined}>
                    {ind.name}
                    {v?.stale && <span className="text-xs text-ink-3"> · 지연</span>}
                  </dt>
                  {v ? (
                    <dd className="flex shrink-0 gap-2 tabular-nums">
                      <span className="font-semibold">{formatMacroValue(ind, v)}</span>
                      <span className={`w-[4.5rem] text-right ${changeClass(v)}`}>{formatMacroChange(ind, v)}</span>
                    </dd>
                  ) : (
                    <dd className="text-xs text-ink-3">조회 실패</dd>
                  )}
                </div>
              );
            })}
          </dl>
        </div>
      ))}
    </div>
  );
}
