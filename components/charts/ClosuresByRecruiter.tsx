"use client";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { name: string; closures: number; isBest?: boolean; isWorst?: boolean };

export default function ClosuresByRecruiter({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={60} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="closures" radius={[4, 4, 0, 0]}>
          {data.map((r, i) => (
            <Cell key={i} fill={r.isBest ? "#16a34a" : r.isWorst ? "#dc2626" : "#64748b"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
