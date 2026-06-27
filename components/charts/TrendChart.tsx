"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

type Row = { week: string; submissions: number; closures: number };

export default function TrendChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="submissions" stroke="#0f172a" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="closures" stroke="#16a34a" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
