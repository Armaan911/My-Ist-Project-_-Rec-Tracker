"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { generateTeamSummary } from "@/app/manager/ai-actions";

const isErrorish = (t: string) => /^AI (error|request failed|summary unavailable)/i.test(t.trim());

// "Today's highlight". Button-triggered ONLY — never calls the AI on page load, so viewing the
// dashboard never spends tokens. The first click serves a cached summary if one is fresh
// (<~3h); "Regenerate" forces a new one.
export default function AISummary() {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function gen(force = false) {
    setBusy(true);
    try {
      const res = await generateTeamSummary(force);
      setText(res?.text ?? "AI summary unavailable — try again.");
    } catch {
      setText("AI summary unavailable — try again.");
    } finally {
      setBusy(false);
    }
  }

  const ok = !!text && !isErrorish(text);

  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-brand-100 bg-surface shadow-sm">
      <div className="flex shrink-0 items-center gap-1.5 bg-danger-600 px-3 text-xs font-extrabold uppercase tracking-wider text-white">
        <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Today’s highlight
      </div>
      <div className="flex flex-1 flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        {text === null && !busy ? (
          <button onClick={() => gen(false)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
            <Sparkles size={15} /> Generate AI summary
          </button>
        ) : (
          <p className={`text-sm font-semibold leading-snug ${ok ? "text-ink" : "text-danger-600"}`}>
            {busy ? "Generating…" : ok ? text!.replace(/\s+/g, " ").trim() : (text || "Couldn’t generate — try again.")}
          </p>
        )}
        {(text !== null || busy) && (
          <button onClick={() => gen(true)} disabled={busy} title={ok ? "Regenerate" : "Retry"}
            className="shrink-0 rounded-md border border-line px-2 py-1 text-xs font-medium text-muted hover:text-ink disabled:opacity-50">
            {busy ? "…" : ok ? "Regenerate" : "Retry"}
          </button>
        )}
      </div>
    </div>
  );
}
