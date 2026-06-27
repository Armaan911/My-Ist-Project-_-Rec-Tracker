"use client";

import { useMemo, useState } from "react";
import { Trash2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { markMessageRead, deleteMessages, deleteAllMessages } from "@/app/messages/actions";
import { Card } from "@/components/ui";
import { toast } from "@/components/uikit";

type Msg = { id: string; subject: string | null; body: string; is_read: boolean; created_at: string; sender?: { full_name: string } | null };

const PAGE_SIZE = 5;

export default function MessagesInbox({ messages }: { messages: Msg[] }) {
  const [list, setList] = useState<Msg[]>(messages);
  const [read, setRead] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);

  const isRead = (m: Msg) => m.is_read || read.has(m.id);
  const unread = list.filter((m) => !isRead(m)).length;

  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = useMemo(() => list.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE), [list, safePage]);

  async function dismiss(id: string) {
    setRead((s) => new Set(s).add(id));
    await markMessageRead(id);
  }

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function removeSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    const res = await deleteMessages(ids);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
    setList((xs) => xs.filter((m) => !selected.has(m.id)));
    setSelected(new Set());
    toast(`Deleted ${ids.length} message${ids.length > 1 ? "s" : ""}`, "success");
  }

  async function removeOne(id: string) {
    setBusy(true);
    const res = await deleteMessages([id]);
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
    setList((xs) => xs.filter((m) => m.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
  }

  async function clearAll() {
    setBusy(true);
    const res = await deleteAllMessages();
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Failed", "error"); return; }
    setList([]); setSelected(new Set()); setPage(0);
    toast("Inbox cleared", "success");
  }

  if (list.length === 0) return null;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Messages</h2>
          {unread > 0 && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{unread} new</span>}
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button disabled={busy} onClick={removeSelected}
              className="inline-flex items-center gap-1 rounded-lg bg-danger-600 px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete selected ({selected.size})
            </button>
          )}
          <button disabled={busy} onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted hover:text-danger-600 disabled:opacity-50">
            <Trash2 size={13} /> Delete all
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {pageItems.map((m) => (
          <li key={m.id} className={`rounded-lg border px-3 py-2 ${isRead(m) ? "border-line opacity-70" : "border-brand-200 bg-brand-50/40"}`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-line" aria-label="Select message" />
              <div className="min-w-0 flex-1">
                {m.subject && <p className="text-sm font-medium">{m.subject}</p>}
                <p className="whitespace-pre-wrap text-sm text-ink">{m.body}</p>
                <p className="mt-1 text-xs text-muted">from {m.sender?.full_name ?? "your manager"} · {m.created_at.slice(0, 10)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!isRead(m) && <button onClick={() => dismiss(m.id)} className="text-xs text-muted underline hover:text-ink">mark read</button>}
                <button onClick={() => removeOne(m.id)} title="Delete" className="text-muted hover:text-danger-600"><Trash2 size={14} /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted">
          <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 disabled:opacity-40 hover:text-ink">
            <ChevronLeft size={14} /> Prev
          </button>
          <span>Page {safePage + 1} of {pageCount}</span>
          <button disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 disabled:opacity-40 hover:text-ink">
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </Card>
  );
}
