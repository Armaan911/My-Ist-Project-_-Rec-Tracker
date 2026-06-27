"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { CalendarRange } from "lucide-react";
import ClosuresByRecruiter from "@/components/charts/ClosuresByRecruiter";
import { recruiterRangeStats } from "@/app/manager/perf-actions";

type Row = { name: string; closures: number; isBest?: boolean; isWorst?: boolean };

// "Closures by recruiter" with its own From–To date filter. Defaults to this month;
// re-fetches per-recruiter closures for the chosen range (and on division change).
export default function ClosuresByRecruiterCard({
  recruiters,
  initial,
  divisionId = null,
  today,
}: {
  recruiters: { id: string; name: string }[];
  initial: Row[];
  divisionId?: string | null;
  today: string;
}) {
  const monthStart = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Row[]>(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!from || !to) return;
    let alive = true;
    setBusy(true);
    recruiterRangeStats(from, to, divisionId).then((res) => {
      if (!alive) return;
      const data = res.data ?? {};
      const built = recruiters.map((r) => ({
        name: r.name,
        closures: data[r.id]?.closures ?? 0,
        subs: data[r.id]?.subs ?? 0,
      }));
      // Highlight best/worst by closures (tiebreak on submissions), matching the
      // server-computed "this month" view.
      let bestName = "";
      let worstName = "";
      if (built.length >= 2) {
        const sorted = [...built].sort((a, b) => b.closures - a.closures || b.subs - a.subs);
        bestName = sorted[0].name;
        worstName = sorted[sorted.length - 1].name;
      }
      setRows(built.map((b) => ({ name: b.name, closures: b.closures, isBest: b.name === bestName, isWorst: b.name === worstName })));
      setBusy(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, divisionId]);

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarRange size={18} className="text-brand-700" /> Closures by recruiter
          {busy && <span className="text-xs font-normal text-muted">· loading…</span>}
        </h2>
        <span className="flex items-center gap-1.5">
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" title="From" />
          <span className="text-xs text-muted">to</span>
          <input type="date" value={to} min={from || undefined} max={today} onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-lg border border-line bg-surface px-2 text-sm" title="To" />
        </span>
      </div>
      <ClosuresByRecruiter data={rows} />
    </Card>
  );
}
