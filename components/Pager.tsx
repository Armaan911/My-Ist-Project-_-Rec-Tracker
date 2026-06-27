"use client";
import { useMemo, useState } from "react";

// Reusable client-side pagination. Default 20 rows/page.
export function usePaged<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const slice = useMemo(() => items.slice((safePage - 1) * pageSize, safePage * pageSize), [items, safePage, pageSize]);
  return { page: safePage, setPage, pageCount, slice, total: items.length, pageSize };
}

export function Pager({ page, pageCount, setPage, total, pageSize }: {
  page: number; pageCount: number; setPage: (n: number) => void; total: number; pageSize: number;
}) {
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const nums: number[] = [];
  for (let i = start; i <= Math.min(pageCount, start + 4); i++) nums.push(i);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-muted">{from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="rounded-md border border-line px-2 py-1 text-xs disabled:opacity-40">Prev</button>
        {nums[0] > 1 && <span className="px-1 text-muted">…</span>}
        {nums.map((n) => (
          <button key={n} onClick={() => setPage(n)} className={`rounded-md px-2.5 py-1 text-xs ${n === page ? "bg-brand-600 text-white" : "border border-line hover:bg-canvas"}`}>{n}</button>
        ))}
        {nums[nums.length - 1] < pageCount && <span className="px-1 text-muted">…</span>}
        <button onClick={() => setPage(Math.min(pageCount, page + 1))} disabled={page === pageCount} className="rounded-md border border-line px-2 py-1 text-xs disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
