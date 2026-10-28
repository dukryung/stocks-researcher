import Link from "next/link";
import { getPrinciples } from "@/lib/queries";
import { addPrinciple, deletePrinciple, movePrinciple, updatePrinciple } from "./actions";

export const dynamic = "force-dynamic";

const input = "w-full rounded-md border border-line bg-bg px-3 py-2 text-sm focus:border-accent focus:outline-none";
const smallBtn = "rounded-md px-2 py-1 text-sm text-ink-2 hover:bg-bg hover:text-ink disabled:opacity-30";

export default async function PrinciplesPage() {
  const principles = await getPrinciples();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">투자 원칙 편집</h1>
        <Link href="/" className="text-sm text-accent hover:underline">
          메인에서 보기 →
        </Link>
      </div>
      <p className="text-sm text-ink-2">여기서 저장한 원칙은 메인 페이지 맨 위에 순서대로 표시됩니다.</p>

      <ol className="space-y-3">
        {principles.map((p, i) => (
          <li key={p.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-accent">원칙 {i + 1}</span>
              <div className="flex gap-1">
                <form action={movePrinciple}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button className={smallBtn} disabled={i === 0} aria-label="위로">
                    ↑
                  </button>
                </form>
                <form action={movePrinciple}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button className={smallBtn} disabled={i === principles.length - 1} aria-label="아래로">
                    ↓
                  </button>
                </form>
                <form action={deletePrinciple}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className={`${smallBtn} hover:text-up`}>삭제</button>
                </form>
              </div>
            </div>
            <form action={updatePrinciple} className="space-y-2">
              <input type="hidden" name="id" value={p.id} />
              <input name="title" defaultValue={p.title} required className={`${input} font-semibold`} aria-label="원칙" />
              <textarea name="body" defaultValue={p.body} rows={2} className={input} aria-label="설명" />
              <div className="text-right">
                <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white">저장</button>
              </div>
            </form>
          </li>
        ))}
      </ol>

      <form action={addPrinciple} className="space-y-2 rounded-xl border border-dashed border-line bg-surface p-4">
        <p className="text-sm font-bold">새 원칙 추가</p>
        <input name="title" required placeholder="예: 이해하지 못하는 기업에는 투자하지 않는다" className={input} />
        <textarea name="body" rows={2} placeholder="설명이나 체크 포인트 (선택)" className={input} />
        <div className="text-right">
          <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white">추가</button>
        </div>
      </form>
    </div>
  );
}
