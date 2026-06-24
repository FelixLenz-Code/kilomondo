"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type CostDatum = {
  month: string;
  fuel: number;
  repair: number;
  cleaning: number;
  other: number;
};

export function CostChart({ data }: { data: CostDatum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Noch keine Kosten erfasst.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={224}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 13% 17%)" vertical={false} />
        <XAxis
          dataKey="month"
          stroke="hsl(220 9% 60%)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(220 9% 60%)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          cursor={{ fill: "hsl(222 13% 17% / 0.4)" }}
          contentStyle={{
            background: "hsl(222 15% 9%)",
            border: "1px solid hsl(222 13% 17%)",
            borderRadius: 12,
            color: "hsl(40 12% 92%)",
          }}
          formatter={(v: number) => `${v.toFixed(2)} €`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="fuel" name="Kraftstoff" stackId="a" fill="hsl(38 92% 55%)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="repair" name="Reparatur" stackId="a" fill="hsl(190 75% 48%)" />
        <Bar dataKey="cleaning" name="Pflege" stackId="a" fill="hsl(280 60% 60%)" />
        <Bar dataKey="other" name="Sonstiges" stackId="a" fill="hsl(160 60% 45%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
