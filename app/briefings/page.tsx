import Link from "next/link";
import { formatBriefingDate } from "@/lib/format";
import { listBriefings } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function BriefingsPage() {
  const briefings = await listBriefings();

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">지난 브리핑</h1>
      {briefings.length === 0 ? (
        <p className="text-sm text-ink-2">저장된 브리핑이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {briefings.map((b) => (
            <li key={b.date}>
              <Link href={`/briefings/${b.date}`} className="block px-5 py-4 hover:bg-bg">
                <p className="font-semibold">
                  {formatBriefingDate(b.date)} <span className="text-sm font-normal text-ink-3">기사 {b.article_count}건</span>
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-ink-2">{b.headline_ko.split("\n")[0]}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
