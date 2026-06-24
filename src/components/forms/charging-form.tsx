"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { InputUnit } from "@/components/ui/input-unit";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { AlertMessage } from "@/components/ui/alert-message";
import { OdometerCapture } from "@/components/forms/odometer-capture";

type State = { error?: string; success?: string };
type Action = (prev: State, formData: FormData) => Promise<State>;

const today = () => new Date().toISOString().slice(0, 10);

function useResettingAction(action: Action, onSuccess?: () => void) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) {
      ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);
  return { state, formAction, ref };
}

export type ChargingDefaults = {
  date: string;
  odometer: number | null;
  energyKwh: number;
  pricePerKwh: number | null;
  totalCost: number | null;
  location: string;
  provider: string | null;
  notes: string | null;
};

export function ChargingForm({
  action,
  defaults,
  onDone,
}: {
  action: Action;
  defaults?: ChargingDefaults;
  onDone?: () => void;
}) {
  const editing = !!defaults;
  const [odometer, setOdometer] = useState(
    defaults?.odometer != null ? String(defaults.odometer) : ""
  );
  const { state, formAction, ref } = useResettingAction(
    action,
    onDone ?? (() => setOdometer(""))
  );

  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <AlertMessage error={state.error} success={state.success} />
      <OdometerCapture onDetect={setOdometer} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">Datum *</Label>
          <Input id="date" name="date" type="date" required defaultValue={defaults ? defaults.date : today()} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Ladeort</Label>
          <Select id="location" name="location" defaultValue={defaults?.location ?? "HOME"}>
            <option value="HOME">Zu Hause</option>
            <option value="PUBLIC">Öffentlich</option>
            <option value="WORK">Arbeit</option>
            <option value="OTHER">Sonstige</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="energyKwh">Geladene Energie *</Label>
          <InputUnit
            id="energyKwh"
            name="energyKwh"
            type="number"
            step="0.01"
            min={0}
            required
            unit="kWh"
            defaultValue={defaults?.energyKwh ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="odometer">Kilometerstand</Label>
          <InputUnit
            id="odometer"
            name="odometer"
            type="number"
            min={0}
            unit="km"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pricePerKwh">Preis je kWh</Label>
          <InputUnit
            id="pricePerKwh"
            name="pricePerKwh"
            type="number"
            step="0.001"
            min={0}
            unit="€/kWh"
            defaultValue={defaults?.pricePerKwh ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="totalCost">Gesamtkosten</Label>
          <InputUnit
            id="totalCost"
            name="totalCost"
            type="number"
            step="0.01"
            min={0}
            unit="€"
            defaultValue={defaults?.totalCost ?? ""}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="provider">Anbieter / Säule</Label>
          <Input
            id="provider"
            name="provider"
            placeholder="z. B. EnBW, Ionity, eigene Wallbox"
            defaultValue={defaults?.provider ?? ""}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Preis oder Gesamtkosten genügt — der jeweils andere Wert wird automatisch berechnet.
      </p>
      <div className="space-y-2">
        <Label htmlFor="notes">Notiz</Label>
        <Textarea id="notes" name="notes" defaultValue={defaults?.notes ?? ""} />
      </div>
      <SubmitButton>{editing ? "Speichern" : "Ladevorgang hinzufügen"}</SubmitButton>
    </form>
  );
}
