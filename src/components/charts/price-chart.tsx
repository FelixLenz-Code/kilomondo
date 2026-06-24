"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type PriceDatum = {
  label: string;
  price: number;
};

export function PriceChart({
  data,
  unit,
}: {
  data: PriceDatum[];
  unit: string;
}) {
  if (data.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Noch nicht genug Tankungen für einen Preisverlauf.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={224}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 13% 17%)" />
        <XAxis
          dataKey="label"
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
          width={48}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => v.toFixed(2)}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(222 15% 9%)",
            border: "1px solid hsl(222 13% 17%)",
            borderRadius: 12,
            color: "hsl(40 12% 92%)",
          }}
          formatter={(v: number) => [`${v.toFixed(3)} €/${unit}`, "Preis"]}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke="hsl(160 84% 39%)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
