import Link from "next/link";
import PrinciplesEditor from "@/components/PrinciplesEditor";
import { getPrinciples } from "@/lib/queries";

export const dynamic = "force-dynamic";

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
      <p className="text-sm text-ink-2">
        추가·삭제·순서 변경·수정을 마친 뒤 하단의 <span className="font-semibold">저장</span> 버튼을 누르면 한 번에 저장됩니다.
      </p>
      <PrinciplesEditor principles={principles} />
    </div>
  );
}
