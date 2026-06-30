"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { name: string; rr: number; client: number };

// Per-recruiter breakup by RR submissions vs Client submissions.
export default function RecruiterStageBar({ data, height = 280 }: { data: Row[]; height?: number }) {
  if (data.length === 0) return <div className="grid h-[240px] place-items-center text-sm text-muted">No submissions yet.</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={60} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="rr" name="Submitted in RR" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="client" name="Submitted to Client" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
