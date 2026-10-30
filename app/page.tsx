import { Suspense } from "react";
import BriefingView from "@/components/BriefingView";
import MacroIndicatorGrid from "@/components/MacroIndicatorGrid";
import MacroSection from "@/components/MacroSection";
import PriceGrid from "@/components/PriceGrid";
import PrinciplesCard from "@/components/PrinciplesCard";
import { formatBriefingDate } from "@/lib/format";
import { fetchMacroIndicators, type MacroValue } from "@/lib/macro";
import { getBriefing, getBriefingArticles, getMacroArticles, getPrinciples } from "@/lib/queries";
import { fetchAllQuotes } from "@/lib/quotes";

export const dynamic = "force-dynamic";

// 주가·지표 API 가 느릴 때도 원칙·브리핑은 바로 보이도록 시세 영역만 따로 스트리밍한다.
async function LivePriceGrid() {
  return <PriceGrid quotes={await fetchAllQuotes()} />;
}

// 실시간 조회에 실패한 지표는 브리핑 시점 값을 '지연'으로 대신 보여준다.
async function LiveMacroIndicators({ snapshot }: { snapshot: Record<string, MacroValue | null> }) {
  const live = await fetchMacroIndicators();
  const values = Object.fromEntries(
    Object.entries(live).map(([id, v]) => [id, v ?? (snapshot[id] ? { ...snapshot[id], stale: true } : null)]),
  );
  return <MacroIndicatorGrid values={values} />;
}

function LoadingBox({ text }: { text: string }) {
  return <p className="rounded-lg border border-line bg-surface p-4 text-sm text-ink-3">{text}</p>;
}

export default async function Home() {
  const [principles, briefing] = await Promise.all([getPrinciples(), getBriefing()]);
  const [articles, macroArticles] = briefing
    ? await Promise.all([getBriefingArticles(briefing.date), getMacroArticles(briefing.date)])
    : [[], []];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

  return (
    <div className="space-y-8">
      <PrinciplesCard principles={principles} />
      <MacroSection
        summary={briefing?.macro ?? null}
        articles={macroArticles}
        generatedAt={briefing?.macro ? briefing.created_at : null}
        indicatorsNote="지표는 실시간 · 1분 캐시 · 미국 지표는 현지 기준 (이름에 마우스를 올리면 시각 표시) · 출처: 네이버 증권"
        indicators={
          <Suspense fallback={<LoadingBox text="지표를 불러오는 중..." />}>
            <LiveMacroIndicators snapshot={briefing?.macro?.indicators ?? {}} />
          </Suspense>
        }
      />
      <Suspense
        fallback={
          <section>
            <h2 className="mb-3 text-lg font-bold">주가</h2>
            <LoadingBox text="시세를 불러오는 중..." />
          </section>
        }
      >
        <LivePriceGrid />
      </Suspense>
      <section>
        <h2 className="mb-3 text-lg font-bold">오늘의 브리핑</h2>
        {!briefing ? (
          <p className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-2">
            아직 생성된 브리핑이 없습니다. 매일 08:30에 자동으로 수집되며, 지금 바로 만들려면 터미널에서{" "}
            <code className="rounded bg-bg px-1">npm run collect</code> 를 실행하세요.
          </p>
        ) : (
          <>
            {briefing.date !== today && (
              <p className="mb-3 rounded-lg bg-accent-soft px-4 py-2 text-sm text-accent">
                오늘 브리핑은 아직 생성되지 않았습니다. 가장 최근 브리핑({formatBriefingDate(briefing.date)})을 보여드립니다.
              </p>
            )}
            <BriefingView briefing={briefing} articles={articles} />
          </>
        )}
      </section>
    </div>
  );
}
