"use client";
import { useEffect, useState } from "react";
import { generateTeamSummary } from "@/app/manager/ai-actions";

const isErrorish = (t: string) => /^AI (error|request failed|summary unavailable)/i.test(t.trim());

// "Today's highlight" banner. Auto-generates the AI team summary and shows it in full —
// it wraps to as many lines as needed so the whole sentence is always readable (no scrolling).
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
  // On error, show the real reason (e.g. "GEMINI_API_KEY is not set", "API key not valid")
  // so it's actually fixable — this banner is manager/admin-only.
  const message = busy
    ? "Generating today’s highlights…"
    : ok
    ? text!.replace(/\s+/g, " ").trim()
    : (text?.replace(/\s+/g, " ").trim() || "Highlights will appear here once AI is available — tap ↻ to retry.");

  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-brand-100 bg-surface shadow-sm">
      <div className="flex shrink-0 items-center gap-1.5 bg-danger-600 px-3 text-xs font-extrabold uppercase tracking-wider text-white">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Today’s highlight
      </div>
      <p className="flex-1 px-4 py-2.5 text-sm font-semibold leading-snug text-ink">{message}</p>
      <button onClick={load} disabled={busy} title="Refresh highlights"
        className="shrink-0 border-l border-line px-3 text-sm font-medium text-muted hover:text-ink disabled:opacity-50">
        {busy ? "…" : "↻"}
      </button>
    </div>
  );
}
