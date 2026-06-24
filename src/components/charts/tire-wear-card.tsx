"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { TireWearChart } from "@/components/charts/tire-wear-chart";
import type { TireWearRow, TireWearLine } from "@/lib/tires";

/**
 * Dashboard card showing the per-tire tread-depth wear curve, with a small
 * dropdown to focus a single tire set (or show all of them at once).
 */
export function TireWearCard({
  sets,
  lines,
  data,
}: {
  sets: { id: string; name: string }[];
  lines: TireWearLine[];
  data: TireWearRow[];
}) {
  const [selected, setSelected] = useState<string>("all");
  const shownLines = selected === "all" ? lines : lines.filter((l) => l.setId === selected);

  return (
    <Card className="glass">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Profil-Verlauf (mm)</CardTitle>
        {sets.length > 1 && (
          <Select
            aria-label="Radsatz wählen"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="h-8 w-auto max-w-[170px] py-1 text-sm"
          >
            <option value="all">Alle Radsätze</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
      </CardHeader>
      <CardContent>
        <TireWearChart data={data} lines={shownLines} />
      </CardContent>
    </Card>
  );
}
