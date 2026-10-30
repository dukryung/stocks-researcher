import Link from "next/link";
import { notFound } from "next/navigation";
import BriefingView from "@/components/BriefingView";
import MacroIndicatorGrid from "@/components/MacroIndicatorGrid";
import MacroSection from "@/components/MacroSection";
import { getBriefing, getBriefingArticles, getMacroArticles } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function BriefingPage({ params }: PageProps<"/briefings/[date]">) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const briefing = await getBriefing(date);
  if (!briefing) notFound();
  const [articles, macroArticles] = await Promise.all([getBriefingArticles(date), getMacroArticles(date)]);

  return (
    <div className="space-y-6">
      <Link href="/briefings" className="inline-block text-sm text-accent hover:underline">
        ← 지난 브리핑
      </Link>
      {briefing.macro && (
        <MacroSection
          summary={briefing.macro}
          articles={macroArticles}
          generatedAt={briefing.created_at}
          indicatorsNote="브리핑 생성 시점의 지표"
          indicators={<MacroIndicatorGrid values={briefing.macro.indicators} />}
        />
      )}
      <BriefingView briefing={briefing} articles={articles} />
    </div>
  );
}
