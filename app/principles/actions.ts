"use server";

// 웹서버는 127.0.0.1 에만 열리므로(npm start) 별도 인증 없이 로컬 사용자만 호출할 수 있다.

import { revalidatePath } from "next/cache";
import { getPool } from "@/lib/db";

export interface PrincipleInput {
  title: string;
  body: string;
}

// 편집 화면의 원칙 목록 전체를 화면 순서 그대로 저장한다. 중간에 실패하면 아무것도 바뀌지 않는다.
export async function savePrinciples(items: PrincipleInput[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const cleaned = items.map((p) => ({ title: String(p.title ?? "").trim(), body: String(p.body ?? "").trim() }));
  if (cleaned.some((p) => !p.title)) return { ok: false, error: "제목이 비어 있는 원칙이 있습니다." };

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM principles");
    for (const [i, p] of cleaned.entries()) {
      await client.query("INSERT INTO principles (title, body, position) VALUES ($1, $2, $3)", [p.title, p.body, i]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("[principles] 저장 실패:", e);
    return { ok: false, error: "저장 중 오류가 발생했습니다. 다시 시도해 주세요." };
  } finally {
    client.release();
  }

  revalidatePath("/");
  revalidatePath("/principles");
  return { ok: true };
}
