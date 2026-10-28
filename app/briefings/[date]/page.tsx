import Link from "next/link";
import { notFound } from "next/navigation";
import BriefingView from "@/components/BriefingView";
import { getBriefing, getBriefingArticles } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function BriefingPage({ params }: PageProps<"/briefings/[date]">) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const briefing = await getBriefing(date);
  if (!briefing) notFound();
  const articles = await getBriefingArticles(date);

  return (
    <div>
      <Link href="/briefings" className="mb-4 inline-block text-sm text-accent hover:underline">
        ← 지난 브리핑
      </Link>
      <BriefingView briefing={briefing} articles={articles} />
    </div>
  );
}
