import type { ReactNode } from "react";
import { formatKst } from "@/lib/format";
import { MACRO_CATEGORY_LABEL, MACRO_MOOD_LABEL, type MacroMood, type MacroSummary } from "@/lib/macro";
import type { MacroArticle } from "@/lib/queries";

const MOOD_STYLE: Record<MacroMood, string> = {
  risk_on: "bg-mood-on-soft text-mood-on",
  neutral: "bg-mood-neutral-soft text-mood-neutral",
  risk_off: "bg-mood-off-soft text-mood-off",
};

const MOOD_ICON: Record<MacroMood, string> = { risk_on: "▲", neutral: "■", risk_off: "▼" };

// indicators 는 메인에선 실시간 지표(스트리밍), 지난 브리핑에선 브리핑 시점 스냅샷이 들어온다.
export default function MacroSection({
  summary,
  articles,
  generatedAt,
  indicators,
  indicatorsNote,
}: {
  summary: MacroSummary | null;
  articles: MacroArticle[];
  generatedAt: Date | null;
  indicators: ReactNode;
  indicatorsNote: string;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold">오늘의 매크로 시황</h2>
          {summary && (
            <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${MOOD_STYLE[summary.mood]}`}>
              {MOOD_ICON[summary.mood]} {MACRO_MOOD_LABEL[summary.mood]}
            </span>
          )}
        </div>
        {generatedAt && <span className="text-xs text-ink-3">요약 {formatKst(generatedAt)} 생성</span>}
      </div>

      {indicators}
      <p className="mt-2 text-xs text-ink-3">{indicatorsNote}</p>

      {!summary ? (
        <p className="mt-5 border-t border-line pt-4 text-sm text-ink-3">
          아직 매크로 요약이 없습니다. 매일 08:30 수집 때 함께 생성됩니다.
        </p>
      ) : (
        <div className="mt-5 grid gap-6 border-t border-line pt-4 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <p className="text-sm text-ink-2">{summary.mood_reason}</p>
            <ul className="space-y-2">
              {summary.bullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-accent">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            {summary.watch.length > 0 && (
              <div className="rounded-lg bg-bg p-3">
                <h3 className="mb-1.5 text-sm font-semibold">주목할 점</h3>
                <ul className="space-y-1 text-sm text-ink-2">
                  {summary.watch.map((w, i) => (
                    <li key={i}>– {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <h3 className="mb-1 text-sm font-semibold">주요 이슈</h3>
            {articles.length === 0 ? (
              <p className="text-sm text-ink-3">수집된 매크로 기사가 없습니다.</p>
            ) : (
              <ul className="divide-y divide-line">
                {articles.map((a) => (
                  <li key={a.id} className="py-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-accent-soft px-1.5 py-0.5 font-semibold text-accent">
                        {MACRO_CATEGORY_LABEL[a.category]}
                      </span>
                      {a.importance >= 3 && <span className="font-semibold text-up">핵심</span>}
                      <span className="text-ink-3">
                        {formatKst(a.published_at)} · {a.source ?? "출처 미상"}
                        {a.lang === "en" && " · 영문"}
                      </span>
                    </div>
                    <a href={a.url} target="_blank" rel="noreferrer" className="mt-0.5 block text-sm font-semibold hover:underline">
                      {a.title_ko || a.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
