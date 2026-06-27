"use client";
import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { Card } from "@/components/ui";
import { askData } from "@/app/manager/ai-actions";

type Turn = { q: string; a: string | null };

const SUGGESTIONS = [
  "Who has the most closures this month?",
  "Which division is behind on submissions?",
  "What client has the most open requirements?",
];

export default function AskData() {
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setQ("");
    setBusy(true);
    setTurns((t) => [...t, { q: text, a: null }]);
    const res = await askData(text);
    setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, a: res.text } : turn)));
    setBusy(false);
  }

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-700"><Sparkles size={15} /></span>
        <h2 className="text-lg font-semibold">Ask about your team</h2>
      </div>
      <p className="mb-3 text-sm text-muted">Plain-English questions about this month&apos;s numbers — submissions, closures, pipeline, requirements.</p>

      {turns.length > 0 && (
        <div className="mb-3 space-y-3">
          {turns.map((t, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-end"><span className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand-600 px-3 py-2 text-sm text-white">{t.q}</span></div>
              <div className="flex justify-start"><span className="max-w-[85%] rounded-2xl rounded-bl-sm bg-canvas px-3 py-2 text-sm text-ink">{t.a ?? "Thinking…"}</span></div>
            </div>
          ))}
        </div>
      )}

      {turns.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => ask(s)} disabled={busy} className="rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-brand-600/40 hover:text-ink disabled:opacity-50">{s}</button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(q); }}
          placeholder="Ask a question…" disabled={busy}
          className="h-10 flex-1 rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-brand-600/50"
        />
        <button onClick={() => ask(q)} disabled={busy || !q.trim()} className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-50" aria-label="Send">
          <Send size={16} />
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted">AI reads a snapshot of your current data to answer. It can be wrong — double-check anything important.</p>
    </Card>
  );
}
