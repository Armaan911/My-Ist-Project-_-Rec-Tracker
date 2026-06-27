"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { name: string; submissions: number; closures: number };

export default function GroupedBar({ data, height = 280 }: { data: Row[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={60} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="submissions" name="Submissions" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="closures" name="Closures" fill="#16a34a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
