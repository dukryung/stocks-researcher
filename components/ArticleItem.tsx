import Link from "next/link";
import { COMPANY_BY_ID } from "@/lib/companies";
import { formatKst } from "@/lib/format";
import type { Article } from "@/lib/queries";

export default function ArticleItem({ article, showCompany = true }: { article: Article; showCompany?: boolean }) {
  const company = COMPANY_BY_ID.get(article.company_id);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {showCompany && company && (
          <Link href={`/company/${company.id}`} className="rounded bg-accent-soft px-1.5 py-0.5 font-semibold text-accent">
            {company.nameKo}
          </Link>
        )}
        {article.importance >= 3 && <span className="font-semibold text-up">핵심</span>}
        <span className="text-ink-3">
          {formatKst(article.published_at)} · {article.source ?? "출처 미상"}
          {article.lang === "en" && " · 영문"}
        </span>
      </div>
      <a href={article.url} target="_blank" rel="noreferrer" className="mt-1 block font-semibold hover:underline">
        {article.title_ko || article.title}
      </a>
      {article.summary_ko && <p className="mt-0.5 text-sm text-ink-2">{article.summary_ko}</p>}
    </li>
  );
}
