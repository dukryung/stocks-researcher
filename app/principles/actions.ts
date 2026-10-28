"use server";

// 웹서버는 127.0.0.1 에만 열리므로(npm start) 별도 인증 없이 로컬 사용자만 호출할 수 있다.

import { revalidatePath } from "next/cache";
import { getPool } from "@/lib/db";

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/principles");
}

export async function addPrinciple(formData: FormData) {
  const title = text(formData, "title");
  if (!title) return;
  await getPool().query(
    `INSERT INTO principles (title, body, position)
     VALUES ($1, $2, COALESCE((SELECT max(position) + 1 FROM principles), 0))`,
    [title, text(formData, "body")],
  );
  refresh();
}

export async function updatePrinciple(formData: FormData) {
  const title = text(formData, "title");
  if (!title) return;
  await getPool().query("UPDATE principles SET title = $1, body = $2, updated_at = now() WHERE id = $3", [
    title,
    text(formData, "body"),
    Number(formData.get("id")),
  ]);
  refresh();
}

export async function deletePrinciple(formData: FormData) {
  await getPool().query("DELETE FROM principles WHERE id = $1", [Number(formData.get("id"))]);
  refresh();
}

export async function movePrinciple(formData: FormData) {
  const id = Number(formData.get("id"));
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const pool = getPool();
  const { rows } = await pool.query<{ id: number }>("SELECT id FROM principles ORDER BY position, id");
  const ids = rows.map((r) => r.id);
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  // 순서를 0..n-1 로 다시 매긴다.
  await pool.query(
    "UPDATE principles p SET position = v.pos FROM unnest($1::int[]) WITH ORDINALITY AS v(id, pos) WHERE p.id = v.id",
    [ids],
  );
  refresh();
}
