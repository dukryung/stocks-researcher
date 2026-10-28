import Link from "next/link";
import { COMPANIES } from "@/lib/companies";
import { changeClass, formatAsOf, formatPct, formatPrice } from "@/lib/format";
import type { Quote } from "@/lib/quotes";

const STATUS_LABEL: Record<string, string> = { OPEN: "장중", CLOSE: "마감", PREOPEN: "개장 전" };

export default function PriceGrid({ quotes }: { quotes: Record<string, Quote | null> }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">주가</h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        {COMPANIES.map((c) => {
          const q = quotes[c.id];
          return (
            <li key={c.id}>
              <Link
                href={`/company/${c.id}`}
                className="block h-full rounded-lg border border-line bg-surface p-3 transition-colors hover:border-accent"
              >
                <p className="truncate text-sm font-semibold">{c.nameKo}</p>
                <p className="text-xs text-ink-3">
                  {c.ticker} · {c.market}
                </p>
                {q ? (
                  <>
                    <p className="mt-2 font-semibold tabular-nums">{formatPrice(q.price, q.currency)}</p>
                    <p className={`text-sm tabular-nums ${changeClass(q.changePct)}`}>{formatPct(q.changePct)}</p>
                    <p className="mt-1 text-[11px] text-ink-3">
                      {STATUS_LABEL[q.marketStatus] ?? ""} {formatAsOf(q.asOf)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-ink-3">시세를 불러오지 못했습니다</p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-3">시세 시각은 각 거래소 현지 시각 · 1분 캐시 · 출처: 네이버 증권, Sina 금융</p>
    </section>
  );
}
