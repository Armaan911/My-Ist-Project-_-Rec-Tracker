"use client";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Slice = { name: string; value: number; color?: string };
const PALETTE = ["#6366f1", "#0ea5e9", "#f59e0b", "#16a34a", "#a855f7", "#ec4899", "#ef4444", "#14b8a6", "#64748b"];

export default function PieBreakdown({ data, height = 240 }: { data: Slice[]; height?: number }) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) return <div className="grid h-[240px] place-items-center text-sm text-muted">No data yet.</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={filtered} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={42} paddingAngle={2}>
          {filtered.map((d, i) => <Cell key={i} fill={d.color ?? PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
