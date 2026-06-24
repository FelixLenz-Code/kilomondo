"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { TireWearRow } from "@/lib/tires";

export function TireWearChart({
  data,
  sets,
}: {
  data: TireWearRow[];
  sets: { key: string; name: string; color: string }[];
}) {
  if (data.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Mindestens zwei Messungen nötig, um einen Abnutzungsverlauf zu zeigen.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
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
          domain={[0, "auto"]}
          tickFormatter={(v: number) => `${v}`}
          unit=" mm"
        />
        <Tooltip
          contentStyle={{
            background: "hsl(222 15% 9%)",
            border: "1px solid hsl(222 13% 17%)",
            borderRadius: 12,
            color: "hsl(40 12% 92%)",
          }}
          formatter={(v: number, name: string) => [`${v.toFixed(1)} mm`, name]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {/* Legal minimum tread depth in Germany. */}
        <ReferenceLine
          y={1.6}
          stroke="hsl(0 72% 60%)"
          strokeDasharray="4 4"
          label={{ value: "Min. 1,6 mm", position: "insideBottomRight", fill: "hsl(0 72% 65%)", fontSize: 11 }}
        />
        {sets.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            connectNulls
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
