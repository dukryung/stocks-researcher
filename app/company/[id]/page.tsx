import { notFound } from "next/navigation";
import ArticleItem from "@/components/ArticleItem";
import PriceChart from "@/components/PriceChart";
import { CATEGORY_LABEL, VISIBLE_CATEGORIES } from "@/lib/categories";
import { COMPANY_BY_ID } from "@/lib/companies";
import { changeClass, formatAsOf, formatPct, formatPrice } from "@/lib/format";
import { getCompanyArticles } from "@/lib/queries";
import { fetchAllQuotes, fetchHistory, type PricePoint } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export default async function CompanyPage({ params }: PageProps<"/company/[id]">) {
  const { id } = await params;
  const company = COMPANY_BY_ID.get(id);
  if (!company) notFound();

  const [quotes, history, articles] = await Promise.all([
    fetchAllQuotes(),
    fetchHistory(company).catch((e): PricePoint[] => {
      console.error(`[history] ${id}:`, e);
      return [];
    }),
    getCompanyArticles(id),
  ]);
  const q = quotes[id];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{company.nameKo}</h1>
            <p className="text-sm text-ink-3">
              {company.ticker} · {company.market}
              {company.executives.length > 0 && ` · ${company.executives.map((e) => e.ko).join(", ")}`}
            </p>
          </div>
          {q && (
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums">{formatPrice(q.price, q.currency)}</p>
              <p className={`tabular-nums ${changeClass(q.changePct)}`}>
                {formatPct(q.changePct)} <span className="text-xs text-ink-3">{formatAsOf(q.asOf)}</span>
              </p>
            </div>
          )}
        </div>
        <div className="mt-5">
          <PriceChart data={history} currency={q?.currency ?? "USD"} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface px-5 pt-4 pb-2">
        <h2 className="font-bold">최근 30일 소식</h2>
        {articles.length === 0 ? (
          <p className="py-3 text-sm text-ink-3">수집된 소식이 없습니다.</p>
        ) : (
          VISIBLE_CATEGORIES.map((cat) => {
            const items = articles.filter((a) => a.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="mt-3">
                <h3 className="text-sm font-semibold text-ink-2">{CATEGORY_LABEL[cat]}</h3>
                <ul className="divide-y divide-line">
                  {items.map((a) => (
                    <ArticleItem key={a.id} article={a} showCompany={false} />
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
