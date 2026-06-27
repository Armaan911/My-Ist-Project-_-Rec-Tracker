"use client";
import { useEffect, useState } from "react";
import { generateTeamSummary } from "@/app/manager/ai-actions";

const isErrorish = (t: string) => /^AI (error|request failed|summary unavailable)/i.test(t.trim());

// "Today's Highlight" news ticker. Auto-generates the AI summary and scrolls the FULL
// text continuously (duplicated content = seamless loop, so the whole sentence is visible).
export default function AISummary() {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  async function load() {
    setBusy(true);
    const res = await generateTeamSummary();
    setText(res?.text ?? null);
    setBusy(false);
  }
  useEffect(() => { load(); }, []);

  const ok = !!text && !isErrorish(text);
  const message = ok
    ? text!.replace(/\s+/g, " ").trim()
    : busy ? "Generating today’s highlights…"
    : "Highlights will appear here once AI is available — tap ↻ to retry.";
  const duration = Math.max(18, Math.min(70, message.length * 0.16));

  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-brand-100 bg-surface shadow-sm">
      <div className="flex shrink-0 items-center gap-1.5 bg-danger-600 px-3 text-xs font-extrabold uppercase tracking-wider text-white">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Today’s highlight
      </div>
      <div className="relative flex flex-1 items-center overflow-hidden">
        <div className="flex shrink-0 animate-ticker whitespace-nowrap will-change-transform" style={{ animationDuration: `${duration}s` }}>
          <span className="px-8 py-2.5 text-sm font-semibold text-ink">{message}</span>
          <span className="px-8 py-2.5 text-sm font-semibold text-ink" aria-hidden>{message}</span>
        </div>
      </div>
      <button onClick={load} disabled={busy} title="Refresh highlights"
        className="shrink-0 border-l border-line px-3 text-sm font-medium text-muted hover:text-ink disabled:opacity-50">
        {busy ? "…" : "↻"}
      </button>
    </div>
  );
}
