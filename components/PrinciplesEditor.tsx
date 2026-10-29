"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePrinciples } from "@/app/principles/actions";
import type { Principle } from "@/lib/queries";

// 추가·삭제·순서 변경·수정은 모두 화면에서만 바뀌고, 하단 저장 버튼 → 확인 팝업을 거쳐 한 번에 저장된다.

interface Item {
  key: string;
  // 기존 원칙이면 DB id, 새로 추가한 원칙이면 null
  id: number | null;
  title: string;
  body: string;
}

const input = "w-full rounded-md border border-line bg-bg px-3 py-2 text-sm focus:border-accent focus:outline-none";
const smallBtn = "rounded-md px-2 py-1 text-sm text-ink-2 hover:bg-bg hover:text-ink disabled:opacity-30";

let nextKey = 0;
const toItems = (principles: Principle[]): Item[] =>
  principles.map((p) => ({ key: `db-${p.id}`, id: p.id, title: p.title, body: p.body }));

function summarize(initial: Item[], items: Item[]) {
  const before = new Map(initial.map((p) => [p.id, p]));
  const keptIds = new Set<number | null>(items.flatMap((p) => (p.id === null ? [] : [p.id])));
  const added = items.filter((p) => p.id === null).length;
  const removed = initial.filter((p) => !keptIds.has(p.id)).length;
  const edited = items.filter((p) => {
    const b = p.id !== null && before.get(p.id);
    return b && (b.title.trim() !== p.title.trim() || b.body.trim() !== p.body.trim());
  }).length;
  const kept = initial.filter((p) => keptIds.has(p.id)).map((p) => p.id);
  const reordered = kept.join() !== items.flatMap((p) => (p.id === null ? [] : [p.id])).join();
  return { added, removed, edited, reordered, dirty: added + removed + edited > 0 || reordered };
}

export default function PrinciplesEditor({ principles }: { principles: Principle[] }) {
  const router = useRouter();
  const [initial, setInitial] = useState(() => toItems(principles));
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const focusKey = useRef<string | null>(null);

  const changes = summarize(initial, items);
  const hasEmptyTitle = items.some((p) => !p.title.trim());

  // 저장하지 않은 변경이 있으면 페이지를 떠날 때 경고한다.
  useEffect(() => {
    if (!changes.dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changes.dirty]);

  // 새로 추가한 원칙의 제목 칸에 커서를 둔다.
  useEffect(() => {
    if (!focusKey.current) return;
    document.getElementById(`title-${focusKey.current}`)?.focus();
    focusKey.current = null;
  }, [items]);

  function update(key: string, patch: Partial<Item>) {
    setSaved(false);
    setItems((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function move(index: number, delta: number) {
    setSaved(false);
    setItems((prev) => {
      const next = [...prev];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }

  function remove(key: string) {
    setSaved(false);
    setItems((prev) => prev.filter((p) => p.key !== key));
  }

  function add() {
    const key = `new-${nextKey++}`;
    focusKey.current = key;
    setSaved(false);
    setItems((prev) => [...prev, { key, id: null, title: "", body: "" }]);
  }

  function confirmSave() {
    startTransition(async () => {
      const result = await savePrinciples(items.map(({ title, body }) => ({ title, body })));
      dialogRef.current?.close();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setSaved(true);
      // 저장 후에는 지금 화면 상태가 새 기준이 된다.
      setInitial(items.map((p, i) => ({ ...p, id: i, title: p.title.trim(), body: p.body.trim() })));
      setItems((prev) => prev.map((p, i) => ({ ...p, id: i, title: p.title.trim(), body: p.body.trim() })));
      router.refresh();
    });
  }

  const changeText = [
    changes.added && `추가 ${changes.added}개`,
    changes.edited && `수정 ${changes.edited}개`,
    changes.removed && `삭제 ${changes.removed}개`,
    changes.reordered && "순서 변경",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3 pb-24">
      {items.length === 0 && <p className="text-sm text-ink-3">원칙이 없습니다. 아래에서 추가하세요.</p>}
      <ol className="space-y-3">
        {items.map((p, i) => (
          <li key={p.key} className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-accent">
                원칙 {i + 1}
                {p.id === null && <span className="ml-2 text-xs font-normal text-ink-3">새 원칙</span>}
              </span>
              <div className="flex gap-1">
                <button type="button" className={smallBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="위로">
                  ↑
                </button>
                <button
                  type="button"
                  className={smallBtn}
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="아래로"
                >
                  ↓
                </button>
                <button type="button" className={`${smallBtn} hover:text-up`} onClick={() => remove(p.key)}>
                  삭제
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <input
                id={`title-${p.key}`}
                value={p.title}
                onChange={(e) => update(p.key, { title: e.target.value })}
                placeholder="예: 이해하지 못하는 기업에는 투자하지 않는다"
                className={`${input} font-semibold ${!p.title.trim() ? "border-up" : ""}`}
                aria-label="원칙"
              />
              <textarea
                value={p.body}
                onChange={(e) => update(p.key, { body: e.target.value })}
                rows={Math.max(2, p.body.split("\n").length)}
                placeholder="설명이나 체크 포인트 (선택)"
                className={input}
                aria-label="설명"
              />
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={add}
        className="w-full rounded-xl border border-dashed border-line bg-surface py-3 text-sm font-semibold text-ink-2 hover:border-accent hover:text-accent"
      >
        + 원칙 추가
      </button>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm" role="status">
            {error ? (
              <span className="text-up">{error}</span>
            ) : changes.dirty ? (
              <span className="text-ink">
                저장하지 않은 변경: <span className="font-semibold">{changeText}</span>
              </span>
            ) : saved ? (
              <span className="text-accent">✓ 저장되었습니다</span>
            ) : (
              <span className="text-ink-3">변경 사항 없음</span>
            )}
          </p>
          <div className="flex items-center gap-3">
            {hasEmptyTitle && <span className="text-xs text-up">비어 있는 제목을 채워 주세요</span>}
            <button
              type="button"
              disabled={!changes.dirty || hasEmptyTitle || pending}
              onClick={() => dialogRef.current?.showModal()}
              className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              저장
            </button>
          </div>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(90vw,24rem)] rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/50"
      >
        <div className="p-5">
          <h2 className="text-base font-bold">저장하시겠습니까?</h2>
          <p className="mt-2 text-sm text-ink-2">{changeText}</p>
          <p className="mt-1 text-sm text-ink-2">저장하면 메인 페이지의 투자 원칙 {items.length}개가 이 내용으로 바뀝니다.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={pending}
            className="rounded-md px-4 py-2 text-sm text-ink-2 hover:bg-bg"
          >
            취소
          </button>
          <button
            type="button"
            onClick={confirmSave}
            disabled={pending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
