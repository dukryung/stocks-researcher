import Link from "next/link";
import ArticleItem from "./ArticleItem";
import { CATEGORY_LABEL, VISIBLE_CATEGORIES } from "@/lib/categories";
import { COMPANIES } from "@/lib/companies";
import { formatBriefingDate, formatKst } from "@/lib/format";
import type { Article, Briefing } from "@/lib/queries";

export default function BriefingView({ briefing, articles }: { briefing: Briefing; articles: Article[] }) {
  const bullets = briefing.headline_ko.split("\n").filter(Boolean);
  const summaries = COMPANIES.filter((c) => briefing.company_summaries[c.id]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">{formatBriefingDate(briefing.date)} 핵심</h2>
          <span className="text-xs text-ink-3">{formatKst(briefing.created_at)} 생성</span>
        </div>
        <ul className="space-y-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent">•</span>
              <span>{b.replace(/^[•\-]\s*/, "")}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {VISIBLE_CATEGORIES.map((cat) => {
            const items = articles.filter((a) => a.category === cat);
            return (
              <section key={cat} className="rounded-xl border border-line bg-surface px-5 pt-4 pb-2">
                <h3 className="font-bold">
                  {CATEGORY_LABEL[cat]} <span className="text-sm font-normal text-ink-3">{items.length}</span>
                </h3>
                {items.length === 0 ? (
                  <p className="py-3 text-sm text-ink-3">새 소식 없음</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {items.map((a) => (
                      <ArticleItem key={a.id} article={a} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <aside className="rounded-xl border border-line bg-surface p-5 lg:self-start">
          <h3 className="mb-3 font-bold">기업별 요약</h3>
          {summaries.length === 0 ? (
            <p className="text-sm text-ink-3">요약할 소식이 없습니다.</p>
          ) : (
            <dl className="space-y-4">
              {summaries.map((c) => (
                <div key={c.id}>
                  <dt>
                    <Link href={`/company/${c.id}`} className="text-sm font-semibold hover:underline">
                      {c.nameKo}
                    </Link>
                  </dt>
                  <dd className="mt-0.5 text-sm text-ink-2">{briefing.company_summaries[c.id]}</dd>
                </div>
              ))}
            </dl>
          )}
        </aside>
      </div>
    </div>
  );
}
