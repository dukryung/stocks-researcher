import BriefingView from "@/components/BriefingView";
import PriceGrid from "@/components/PriceGrid";
import PrinciplesCard from "@/components/PrinciplesCard";
import { formatBriefingDate } from "@/lib/format";
import { getBriefing, getBriefingArticles, getPrinciples } from "@/lib/queries";
import { fetchAllQuotes } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [principles, quotes, briefing] = await Promise.all([getPrinciples(), fetchAllQuotes(), getBriefing()]);
  const articles = briefing ? await getBriefingArticles(briefing.date) : [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

  return (
    <div className="space-y-8">
      <PrinciplesCard principles={principles} />
      <PriceGrid quotes={quotes} />
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
