"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { InputUnit } from "@/components/ui/input-unit";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { AlertMessage } from "@/components/ui/alert-message";

type State = { error?: string; success?: string };
type Action = (prev: State, formData: FormData) => Promise<State>;

const toDateInput = (d: Date | string) =>
  (typeof d === "string" ? new Date(d) : d).toISOString().slice(0, 10);

export type LeasingDefaults = {
  provider: string | null;
  monthlyRate: number | null;
  downPayment: number | null;
  startDate: Date | string;
  endDate: Date | string;
  startOdometer: number;
  annualKmLimit: number | null;
  excessKmCost: number | null;
  notes: string | null;
};

export function LeasingForm({
  action,
  defaults,
}: {
  action: Action;
  defaults?: LeasingDefaults;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <AlertMessage error={state.error} success={state.success} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">Vertragsbeginn *</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            required
            defaultValue={defaults ? toDateInput(defaults.startDate) : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">Vertragsende *</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            required
            defaultValue={defaults ? toDateInput(defaults.endDate) : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="monthlyRate">Monatsrate</Label>
          <InputUnit
            id="monthlyRate"
            name="monthlyRate"
            type="number"
            step="0.01"
            min={0}
            unit="€"
            defaultValue={defaults?.monthlyRate ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="downPayment">Anzahlung</Label>
          <InputUnit
            id="downPayment"
            name="downPayment"
            type="number"
            step="0.01"
            min={0}
            unit="€"
            defaultValue={defaults?.downPayment ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startOdometer">Kilometerstand bei Beginn</Label>
          <InputUnit
            id="startOdometer"
            name="startOdometer"
            type="number"
            min={0}
            unit="km"
            defaultValue={defaults?.startOdometer ?? 0}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="annualKmLimit">km-Limit pro Jahr</Label>
          <InputUnit
            id="annualKmLimit"
            name="annualKmLimit"
            type="number"
            min={0}
            unit="km"
            placeholder="z. B. 15000"
            defaultValue={defaults?.annualKmLimit ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="excessKmCost">Mehrkilometer-Kosten</Label>
          <InputUnit
            id="excessKmCost"
            name="excessKmCost"
            type="number"
            step="0.001"
            min={0}
            unit="€/km"
            defaultValue={defaults?.excessKmCost ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="provider">Anbieter</Label>
          <Input
            id="provider"
            name="provider"
            placeholder="z. B. Mercedes-Benz Leasing"
            defaultValue={defaults?.provider ?? ""}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notiz</Label>
        <Textarea id="notes" name="notes" defaultValue={defaults?.notes ?? ""} />
      </div>
      <SubmitButton>{defaults ? "Leasing-Daten speichern" : "Leasing anlegen"}</SubmitButton>
    </form>
  );
}
