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
const toDateInput = (d: Date | string) =>
  (typeof d === "string" ? new Date(d) : d).toISOString().slice(0, 10);

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

export type TireSetDefaults = {
  name: string;
  season: string;
  dimension: string | null;
  brand: string | null;
  purchaseDate: Date | string | null;
  treadDepthMm: number | null;
  storageLocation: string | null;
  retired: boolean;
  notes: string | null;
  wearAlertMm: number | null;
};

export function TireSetForm({
  action,
  defaults,
  onDone,
}: {
  action: Action;
  defaults?: TireSetDefaults;
  onDone?: () => void;
}) {
  const editing = !!defaults;
  const { state, formAction, ref } = useResettingAction(action, onDone);
  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <AlertMessage error={state.error} success={state.success} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Bezeichnung *</Label>
          <Input
            id="name"
            name="name"
            required
            placeholder="z. B. Winter Alu"
            defaultValue={defaults?.name ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="season">Saison</Label>
          <Select id="season" name="season" defaultValue={defaults?.season ?? "SUMMER"}>
            <option value="SUMMER">Sommer</option>
            <option value="WINTER">Winter</option>
            <option value="ALLSEASON">Ganzjahr</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dimension">Reifengröße</Label>
          <Input
            id="dimension"
            name="dimension"
            placeholder="205/55 R16 91V"
            defaultValue={defaults?.dimension ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand">Marke / Modell</Label>
          <Input
            id="brand"
            name="brand"
            placeholder="z. B. Continental WinterContact"
            defaultValue={defaults?.brand ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="treadDepthMm">Profiltiefe</Label>
          <InputUnit
            id="treadDepthMm"
            name="treadDepthMm"
            type="number"
            step="0.1"
            min={0}
            unit="mm"
            defaultValue={defaults?.treadDepthMm ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="purchaseDate">Kaufdatum</Label>
          <Input
            id="purchaseDate"
            name="purchaseDate"
            type="date"
            defaultValue={defaults?.purchaseDate ? toDateInput(defaults.purchaseDate) : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="storageLocation">Einlagerungsort</Label>
          <Input
            id="storageLocation"
            name="storageLocation"
            placeholder="z. B. Keller, Reifenhotel"
            defaultValue={defaults?.storageLocation ?? ""}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="wearAlertMm">Warnen ab Profiltiefe</Label>
          <InputUnit
            id="wearAlertMm"
            name="wearAlertMm"
            type="number"
            step="0.1"
            min={0}
            unit="mm"
            defaultValue={editing ? defaults?.wearAlertMm ?? "" : 2.5}
          />
          <p className="text-xs text-muted-foreground">
            Erinnerung, sobald der niedrigste gemessene Reifen diese Tiefe erreicht
            (gesetzliches Minimum 1,6 mm). Leer = keine Warnung.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notiz</Label>
        <Textarea id="notes" name="notes" defaultValue={defaults?.notes ?? ""} />
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/30 p-3 text-sm">
        <input
          type="checkbox"
          name="retired"
          defaultChecked={defaults?.retired ?? false}
          className="mt-0.5 size-4 accent-[hsl(38_92%_55%)]"
        />
        <span>
          <span className="font-medium">Ausgemustert</span>
          <span className="block text-xs text-muted-foreground">
            Verschlissene/verkaufte Sätze ausblenden, ohne die Historie zu verlieren.
          </span>
        </span>
      </label>
      <SubmitButton>{editing ? "Speichern" : "Radsatz hinzufügen"}</SubmitButton>
    </form>
  );
}

export type TireChangeDefaults = {
  tireSetId: string;
  date: string;
  odometer: number;
  notes: string | null;
};

export function TireChangeForm({
  action,
  sets,
  defaults,
  onDone,
}: {
  action: Action;
  sets: { id: string; name: string }[];
  defaults?: TireChangeDefaults;
  onDone?: () => void;
}) {
  const editing = !!defaults;
  const [odometer, setOdometer] = useState(defaults ? String(defaults.odometer) : "");
  const { state, formAction, ref } = useResettingAction(
    action,
    onDone ?? (() => setOdometer(""))
  );

  if (sets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Lege zuerst einen Radsatz an, um Wechsel zu erfassen.
      </p>
    );
  }

  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <AlertMessage error={state.error} success={state.success} />
      <div className="space-y-2">
        <Label htmlFor="tireSetId">Aufgezogener Radsatz *</Label>
        <Select
          id="tireSetId"
          name="tireSetId"
          required
          defaultValue={defaults?.tireSetId ?? ""}
        >
          <option value="" disabled>
            Bitte wählen…
          </option>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <OdometerCapture onDetect={setOdometer} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">Datum *</Label>
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={defaults ? defaults.date : today()}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="odometer">Kilometerstand *</Label>
          <InputUnit
            id="odometer"
            name="odometer"
            type="number"
            min={0}
            required
            unit="km"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notiz</Label>
        <Input id="notes" name="notes" defaultValue={defaults?.notes ?? ""} />
      </div>
      <SubmitButton>{editing ? "Speichern" : "Radwechsel eintragen"}</SubmitButton>
    </form>
  );
}

export function TireMeasurementForm({
  action,
  sets,
  onDone,
}: {
  action: Action;
  sets: { id: string; name: string }[];
  onDone?: () => void;
}) {
  const [odometer, setOdometer] = useState("");
  const { state, formAction, ref } = useResettingAction(
    action,
    onDone ?? (() => setOdometer(""))
  );

  if (sets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Lege zuerst einen Radsatz an, um die Profiltiefe zu erfassen.
      </p>
    );
  }

  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <AlertMessage error={state.error} success={state.success} />
      <div className="space-y-2">
        <Label htmlFor="m-tireSetId">Radsatz *</Label>
        <Select
          id="m-tireSetId"
          name="tireSetId"
          required
          defaultValue={sets.length === 1 ? sets[0].id : ""}
        >
          {sets.length > 1 && (
            <option value="" disabled>
              Bitte wählen…
            </option>
          )}
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="m-date">Datum *</Label>
        <Input id="m-date" name="date" type="date" required defaultValue={today()} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm text-muted-foreground">
          Profiltiefe je Reifen (mind. einen Wert) *
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { name: "treadFrontLeftMm", label: "Vorne links" },
            { name: "treadFrontRightMm", label: "Vorne rechts" },
            { name: "treadRearLeftMm", label: "Hinten links" },
            { name: "treadRearRightMm", label: "Hinten rechts" },
          ].map((pos) => (
            <div key={pos.name} className="space-y-1.5">
              <Label htmlFor={`m-${pos.name}`} className="text-xs">
                {pos.label}
              </Label>
              <InputUnit
                id={`m-${pos.name}`}
                name={pos.name}
                type="number"
                step="0.1"
                min={0}
                unit="mm"
              />
            </div>
          ))}
        </div>
      </fieldset>
      <OdometerCapture onDetect={setOdometer} />
      <div className="space-y-2">
        <Label htmlFor="m-odometer">Kilometerstand</Label>
        <InputUnit
          id="m-odometer"
          name="odometer"
          type="number"
          min={0}
          unit="km"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="m-notes">Notiz</Label>
        <Input id="m-notes" name="notes" />
      </div>
      <SubmitButton>Profiltiefe eintragen</SubmitButton>
    </form>
  );
}
