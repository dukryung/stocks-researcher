import Link from "next/link";
import type { Principle } from "@/lib/queries";

export default function PrinciplesCard({ principles }: { principles: Principle[] }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">나의 투자 원칙</h2>
        <Link href="/principles" className="text-sm text-accent hover:underline">
          편집
        </Link>
      </div>
      {principles.length === 0 ? (
        <p className="text-sm text-ink-2">
          아직 원칙이 없습니다.{" "}
          <Link href="/principles" className="text-accent hover:underline">
            투자 원칙 편집
          </Link>
          에서 매일 아침 되새길 원칙을 추가하세요.
        </p>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2">
          {principles.map((p, i) => (
            <li key={p.id} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{p.title}</p>
                {p.body && <p className="mt-0.5 whitespace-pre-line text-sm text-ink-2">{p.body}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
