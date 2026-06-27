"use client";
import { useState } from "react";
import { Card } from "@/components/ui";

type Row = {
  name: string;
  closures: number;
  submissions: number;
  closuresAll: number;
  medal: { name: string; color: string | null } | null;
  target: number | null;
};
type Periods = { month: Row[]; prevMonth: Row[]; year: Row[]; prevYear: Row[] };

const PERIODS: { value: keyof Periods; label: string }[] = [
  { value: "month", label: "Current month" },
  { value: "prevMonth", label: "Previous month" },
  { value: "year", label: "Current year" },
  { value: "prevYear", label: "Previous year" },
];

export default function Leaderboard({ periods }: { periods: Periods }) {
  const [period, setPeriod] = useState<keyof Periods>("month");
  const rows = periods?.[period] ?? [];
  const isMonthly = period === "month" || period === "prevMonth";

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Podium — {PERIODS.find((p) => p.value === period)?.label.toLowerCase()}</h2>
        <select value={period} onChange={(e) => setPeriod(e.target.value as keyof Periods)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm">
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">#</th><th>Recruiter</th><th>Medal</th>
              <th className="text-right">Closures</th>
              <th className="text-right">Subs</th>
              <th className="text-right">Target</th>
              <th className="text-right">Closures (all)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-2 font-semibold text-slate-400">{i + 1}</td>
                <td className="font-medium">{r.name}</td>
                <td>
                  {r.medal ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                          style={{ backgroundColor: (r.medal.color ?? "#eee") + "55" }}>
                      ● {r.medal.name}
                    </span>
                  ) : <span className="text-xs text-slate-400">—</span>}
                </td>
                <td className="text-right font-semibold">{r.closures}</td>
                <td className="text-right">
                  {r.submissions}
                  {isMonthly && r.target != null && (
                    <span className={r.submissions >= r.target ? "text-green-600" : "text-amber-600"}> /{r.target}</span>
                  )}
                </td>
                <td className="text-right text-slate-500">{r.target ?? "—"}</td>
                <td className="text-right text-slate-500">{r.closuresAll}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="py-4 text-slate-400">No recruiters in scope.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
