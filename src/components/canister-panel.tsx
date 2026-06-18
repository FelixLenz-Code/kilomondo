"use client";

import { useState } from "react";
import { Plus, Fuel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/delete-button";
import { CanisterCreateForm, CanisterFillForm } from "@/components/forms/entry-forms";
import {
  createCanisterAction,
  createCanisterFillAction,
  deleteCanisterAction,
} from "@/actions/canisters";
import { formatCurrency, formatNumber } from "@/lib/utils";

export type CanisterView = {
  id: string;
  name: string;
  capacity: number;
  fuelType: string | null;
  liters: number;
  value: number;
  avgPrice: number;
};

const fuelTypeLabel: Record<string, string> = {
  PETROL: "Benzin",
  DIESEL: "Diesel",
  ELECTRIC: "Elektro",
  HYBRID: "Hybrid",
  LPG: "LPG",
};

export function CanisterPanel({
  vehicleId,
  unit,
  canisters,
}: {
  vehicleId: string;
  unit: "L" | "kWh";
  canisters: CanisterView[];
}) {
  const [adding, setAdding] = useState(false);
  const [fillId, setFillId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {canisters.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">
          Noch keine Kanister. Lege einen an, um Reserve-Sprit zu erfassen.
        </p>
      )}

      {canisters.map((c) => {
        const pct = c.capacity > 0 ? Math.min(100, (c.liters / c.capacity) * 100) : 0;
        return (
          <div key={c.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.fuelType && (
                    <Badge variant="secondary">{fuelTypeLabel[c.fuelType] ?? c.fuelType}</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(c.liters, 1)} / {formatNumber(c.capacity, 1)} {unit}
                  {c.liters > 0 &&
                    ` · ${formatCurrency(c.value)} (Ø ${c.avgPrice.toFixed(3)} €/${unit})`}
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFillId(fillId === c.id ? null : c.id)}
                >
                  <Fuel className="size-4" /> Befüllen
                </Button>
                <DeleteButton
                  action={deleteCanisterAction.bind(null, c.id, vehicleId)}
                  confirmText={`Kanister „${c.name}" löschen? Bereits ins Auto gefüllte Mengen bleiben erhalten.`}
                />
              </div>
            </div>
            {fillId === c.id && (
              <div className="mt-3 border-t border-border/60 pt-3">
                <CanisterFillForm
                  action={createCanisterFillAction.bind(null, c.id, vehicleId)}
                  unit={unit}
                />
              </div>
            )}
          </div>
        );
      })}

      {adding ? (
        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
          <CanisterCreateForm action={createCanisterAction.bind(null, vehicleId)} />
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Abbrechen
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Kanister hinzufügen
        </Button>
      )}
    </div>
  );
}
