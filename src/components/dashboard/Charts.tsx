import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// recharts is heavy (~150KB). This module is lazy-loaded by the Dashboard so
// it never lands in the main bundle / initial paint.

const TOOLTIP_STYLE = {
  background: "hsl(0 0% 100%)",
  border: "1px solid hsl(240 8% 88%)",
  borderRadius: 12,
  fontSize: 12,
  color: "hsl(210 38% 15%)",
  boxShadow: "0 4px 16px rgba(23,41,53,0.10)",
};

export function WeeklyBar({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(220 14% 55%)" }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(220 14% 55%)" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(103,53,225,0.08)" }} />
        <Bar dataKey="count" fill="#6735E1" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PriorityPie({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <PieChart width={130} height={130}>
      <Pie data={data} cx={60} cy={60} innerRadius={36} outerRadius={60} paddingAngle={3} dataKey="value">
        {data.map((entry, i) => (
          <Cell key={i} fill={entry.color} />
        ))}
      </Pie>
      <Tooltip contentStyle={TOOLTIP_STYLE} />
    </PieChart>
  );
}
