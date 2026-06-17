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
import { FuelPumpCapture } from "@/components/forms/fuel-pump-capture";
import { MultiImagePicker } from "@/components/forms/multi-image-picker";

function BeforeAfterImages() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MultiImagePicker name="beforeImages" label="Vorher-Bilder" />
      <MultiImagePicker name="afterImages" label="Nachher-Bilder" />
    </div>
  );
}

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

const fuelLabels = { L: "Liter", kWh: "kWh" } as const;

export function FuelForm({ action, unit }: { action: Action; unit: "L" | "kWh" }) {
  const [odometer, setOdometer] = useState("");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [total, setTotal] = useState("");
  const [totalEdited, setTotalEdited] = useState(false);

  const { state, formAction, ref } = useResettingAction(action, () => {
    setOdometer("");
    setAmount("");
    setPrice("");
    setTotal("");
    setTotalEdited(false);
  });

  // Auto-calculate the total price from amount × price per unit, unless the
  // user has manually overridden the total.
  useEffect(() => {
    if (totalEdited) return;
    const a = parseFloat(amount.replace(",", "."));
    const p = parseFloat(price.replace(",", "."));
    if (!isNaN(a) && !isNaN(p)) setTotal((a * p).toFixed(2));
  }, [amount, price, totalEdited]);

  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <AlertMessage error={state.error} success={state.success} />
      <OdometerCapture onDetect={setOdometer} />
      <FuelPumpCapture
        onDetect={({ amount: a, price: p }) => {
          if (a !== undefined) setAmount(a);
          if (p !== undefined) {
            setPrice(p);
            setTotalEdited(false);
          }
        }}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">Datum *</Label>
          <Input id="date" name="date" type="date" required defaultValue={today()} />
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
        <div className="space-y-2">
          <Label htmlFor="amount">Menge *</Label>
          <InputUnit
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min={0}
            required
            unit={unit}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={fuelLabels[unit]}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pricePerUnit">Preis pro {unit}</Label>
          <InputUnit
            id="pricePerUnit"
            name="pricePerUnit"
            type="number"
            step="0.001"
            min={0}
            unit={`€/${unit}`}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="totalCost">Gesamtpreis * (autom.)</Label>
          <InputUnit
            id="totalCost"
            name="totalCost"
            type="number"
            step="0.01"
            min={0}
            required
            unit="€"
            value={total}
            onChange={(e) => {
              setTotal(e.target.value);
              setTotalEdited(true);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="station">Tankstelle</Label>
          <Input id="station" name="station" placeholder="z. B. Aral" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isFullTank" defaultChecked className="size-4 accent-[hsl(38_92%_55%)]" />
        Volltankung (für Verbrauchsberechnung)
      </label>
      <div className="space-y-2">
        <Label htmlFor="notes">Notizen</Label>
        <Textarea id="notes" name="notes" />
      </div>
      <SubmitButton>Tankung hinzufügen</SubmitButton>
    </form>
  );
}

export function OdometerForm({ action }: { action: Action }) {
  const [odometer, setOdometer] = useState("");
  const { state, formAction, ref } = useResettingAction(action, () =>
    setOdometer("")
  );

  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <AlertMessage error={state.error} success={state.success} />
      <OdometerCapture onDetect={setOdometer} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">Datum *</Label>
          <Input id="date" name="date" type="date" required defaultValue={today()} />
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
        <Label htmlFor="note">Notiz</Label>
        <Input id="note" name="note" />
      </div>
      <SubmitButton>Eintrag hinzufügen</SubmitButton>
    </form>
  );
}

export function RepairForm({ action }: { action: Action }) {
  const { state, formAction, ref } = useResettingAction(action);
  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <AlertMessage error={state.error} success={state.success} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">Datum *</Label>
          <Input id="date" name="date" type="date" required defaultValue={today()} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Kategorie</Label>
          <Select id="category" name="category" defaultValue="REPAIR">
            <option value="REPAIR">Reparatur</option>
            <option value="SERVICE">Inspektion / Service</option>
            <option value="INSPECTION">HU / AU (TÜV)</option>
            <option value="TIRES">Reifen</option>
            <option value="OTHER">Sonstiges</option>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Titel *</Label>
          <Input id="title" name="title" required placeholder="z. B. Bremsbeläge vorne" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost">Kosten</Label>
          <InputUnit id="cost" name="cost" type="number" step="0.01" min={0} defaultValue={0} unit="€" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="odometer">Kilometerstand</Label>
          <InputUnit id="odometer" name="odometer" type="number" min={0} unit="km" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="workshop">Werkstatt</Label>
          <Input id="workshop" name="workshop" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Beschreibung</Label>
        <Textarea id="description" name="description" />
      </div>
      <BeforeAfterImages />
      <SubmitButton>Eintrag hinzufügen</SubmitButton>
    </form>
  );
}

export function CleaningForm({ action }: { action: Action }) {
  const { state, formAction, ref } = useResettingAction(action);
  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <AlertMessage error={state.error} success={state.success} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">Datum *</Label>
          <Input id="date" name="date" type="date" required defaultValue={today()} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Art</Label>
          <Select id="type" name="type" defaultValue="FULL">
            <option value="FULL">Komplett</option>
            <option value="EXTERIOR">Außen</option>
            <option value="INTERIOR">Innen</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost">Kosten</Label>
          <InputUnit id="cost" name="cost" type="number" step="0.01" min={0} defaultValue={0} unit="€" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="odometer">Kilometerstand</Label>
          <InputUnit id="odometer" name="odometer" type="number" min={0} unit="km" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="products">Verwendete Produkte</Label>
          <Input id="products" name="products" placeholder="z. B. Hartwachs, Felgenreiniger" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notizen</Label>
        <Textarea id="notes" name="notes" />
      </div>
      <BeforeAfterImages />
      <SubmitButton>Eintrag hinzufügen</SubmitButton>
    </form>
  );
}
