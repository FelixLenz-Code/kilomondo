"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  MultiFilePicker,
  type ExistingAttachment,
} from "@/components/forms/multi-file-picker";
import { useFormDraft } from "@/components/forms/use-form-draft";

function BeforeAfterImages({ editing = false }: { editing?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <MultiImagePicker name="beforeImages" label="Vorher-Bilder" />
        <MultiImagePicker name="afterImages" label="Nachher-Bilder" />
      </div>
      {editing && (
        <p className="text-xs text-muted-foreground">
          Bereits gespeicherte Bilder bleiben erhalten; hier ausgewählte Bilder
          werden ergänzt.
        </p>
      )}
    </div>
  );
}

const toDateInput = (d: Date | string) =>
  (typeof d === "string" ? new Date(d) : d).toISOString().slice(0, 10);

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

const num = (s: string) => {
  const n = parseFloat((s ?? "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type FuelDefaults = {
  date: string;
  odometer: number;
  amount: number;
  pricePerUnit: number;
  totalCost: number;
  isFullTank: boolean;
  station: string | null;
  notes: string | null;
  adbluePrice: number | null;
};

type FuelDraft = {
  date: string;
  odometer: string;
  amount: string;
  price: string;
  total: string;
  totalEdited: boolean;
  station: string;
  notes: string;
  isFullTank: boolean;
  withCan: boolean;
  litersById: Record<string, string>;
  adblue: boolean;
  adbluePrice: string;
};

export function FuelForm({
  action,
  unit,
  canisters = [],
  defaults,
  onDone,
  vehicleId,
  adblueEnabled = false,
}: {
  action: Action;
  unit: "L" | "kWh";
  canisters?: { id: string; name: string; capacity: number; currentLiters: number }[];
  defaults?: FuelDefaults;
  onDone?: () => void;
  // Enables the "Zwischenspeichern" draft feature (create mode only).
  vehicleId?: string;
  // Shows the optional "also refueled AdBlue" checkbox + price (per vehicle setting).
  adblueEnabled?: boolean;
}) {
  const editing = !!defaults;
  const [date, setDate] = useState(defaults ? defaults.date : today());
  const [odometer, setOdometer] = useState(defaults ? String(defaults.odometer) : "");
  const [price, setPrice] = useState(defaults ? String(defaults.pricePerUnit) : "");
  // "Menge" = what came out of the pump. Without canisters this is what goes
  // into the car; with canisters it's the total to be split (car gets the rest).
  const [amount, setAmount] = useState(defaults ? String(defaults.amount) : "");
  const [total, setTotal] = useState(defaults ? String(defaults.totalCost) : "");
  // total auto-calculates from amount × price until the user overrides it.
  const [totalEdited, setTotalEdited] = useState(false);
  const [station, setStation] = useState(defaults?.station ?? "");
  const [notes, setNotes] = useState(defaults?.notes ?? "");
  const [isFullTank, setIsFullTank] = useState(defaults ? defaults.isFullTank : true);
  const [withCan, setWithCan] = useState(false);
  const [litersById, setLitersById] = useState<Record<string, string>>({});
  const [adblue, setAdblue] = useState(defaults ? defaults.adbluePrice != null : false);
  const [adbluePrice, setAdbluePrice] = useState(
    defaults?.adbluePrice != null ? String(defaults.adbluePrice) : ""
  );

  // Draft persistence: keyed per vehicle, disabled while editing an entry.
  const { restored, save, clear } = useFormDraft<FuelDraft>(
    !editing && vehicleId ? `fuel:${vehicleId}` : null
  );
  const [draftMsg, setDraftMsg] = useState<string | null>(null);

  function resetFields() {
    setDate(today());
    setOdometer("");
    setPrice("");
    setAmount("");
    setTotal("");
    setTotalEdited(false);
    setStation("");
    setNotes("");
    setIsFullTank(true);
    setWithCan(false);
    setLitersById({});
    setAdblue(false);
    setAdbluePrice("");
  }

  const { state, formAction, ref } = useResettingAction(action, onDone ?? (() => {
    resetFields();
    clear();
    setDraftMsg(null);
  }));

  // Re-hydrate a saved draft once, after mount.
  const draftApplied = useRef(false);
  useEffect(() => {
    if (!restored || draftApplied.current) return;
    draftApplied.current = true;
    setDate(restored.date || today());
    setOdometer(restored.odometer ?? "");
    setPrice(restored.price ?? "");
    setAmount(restored.amount ?? "");
    setTotal(restored.total ?? "");
    setTotalEdited(restored.totalEdited ?? false);
    setStation(restored.station ?? "");
    setNotes(restored.notes ?? "");
    setIsFullTank(restored.isFullTank ?? true);
    setWithCan(restored.withCan ?? false);
    setLitersById(restored.litersById ?? {});
    setAdblue(restored.adblue ?? false);
    setAdbluePrice(restored.adbluePrice ?? "");
    setDraftMsg("Zwischengespeicherten Entwurf wiederhergestellt.");
  }, [restored]);

  const collectDraft = (): FuelDraft => ({
    date,
    odometer,
    amount,
    price,
    total,
    totalEdited,
    station,
    notes,
    isFullTank,
    withCan,
    litersById,
    adblue,
    adbluePrice,
  });

  // Keep the latest values reachable from the visibility listener without
  // re-binding it on every keystroke.
  const draftRef = useRef(collectDraft());
  draftRef.current = collectDraft();

  // Safety net: also persist when the tab is hidden / the app is backgrounded
  // (e.g. screen lock while paying), so nothing is lost even without a click.
  useEffect(() => {
    if (editing || !vehicleId) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        const d = draftRef.current;
        const hasContent = d.odometer || d.amount || d.price || d.total || d.station || d.notes;
        if (hasContent) save(d);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [editing, vehicleId, save]);

  function saveDraft() {
    save(collectDraft());
    const t = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    setDraftMsg(`Zwischengespeichert um ${t} Uhr.`);
  }

  function discardDraft() {
    clear();
    // Also empty the form so the visibility autosave below can't re-persist it.
    resetFields();
    setDraftMsg(null);
  }

  // total = amount × price, unless the user typed a total or split across
  // canisters. In edit mode the first run is skipped so the stored total stays
  // until the user actually changes the amount or price.
  const skipFirstAuto = useRef(editing);
  useEffect(() => {
    if (withCan || totalEdited) return;
    if (skipFirstAuto.current) {
      skipFirstAuto.current = false;
      return;
    }
    const a = parseFloat(amount.replace(",", "."));
    const p = parseFloat(price.replace(",", "."));
    if (!isNaN(a) && !isNaN(p)) setTotal((a * p).toFixed(2));
  }, [amount, price, totalEdited, withCan]);

  // Combined-mode derived values: car gets the pumped amount minus the canisters.
  const p = num(price);
  const selected = canisters
    .map((c) => ({ ...c, liters: num(litersById[c.id] ?? "") }))
    .filter((c) => c.liters > 0);
  const canSum = selected.reduce((s, c) => s + c.liters, 0);
  const carLiters = r2(num(amount) - canSum);
  const carCost = r2(carLiters * p);

  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <AlertMessage error={state.error} success={state.success} />
      <OdometerCapture onDetect={setOdometer} />
      <FuelPumpCapture
        onDetect={({ amount: a, price: pp }) => {
          if (a !== undefined) setAmount(a);
          if (pp !== undefined) {
            setPrice(pp);
            setTotalEdited(false);
          }
        }}
      />

      {canisters.length > 0 && (
        <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/30 p-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={withCan}
            onChange={(e) => setWithCan(e.target.checked)}
            className="size-4 accent-[hsl(38_92%_55%)]"
          />
          An dieser Tankstelle auch Kanister aufgefüllt
        </label>
      )}

      {withCan && (
        <div className="space-y-3 rounded-lg border border-border/60 bg-background/30 p-3">
          <p className="text-sm font-medium">Welche Kanister wurden mitgefüllt?</p>
          {canisters.map((c) => {
            const on = litersById[c.id] !== undefined;
            const free = r2(c.capacity - c.currentLiters);
            return (
              <div key={c.id} className="space-y-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) =>
                      setLitersById((m) => {
                        const next = { ...m };
                        // Default to filling the canister to the brim.
                        if (e.target.checked) next[c.id] = free > 0 ? String(free) : "";
                        else delete next[c.id];
                        return next;
                      })
                    }
                    className="size-4 accent-[hsl(38_92%_55%)]"
                  />
                  {c.name}
                  <span className="text-xs text-muted-foreground">({free.toFixed(1)} {unit} frei)</span>
                </label>
                {on && (
                  <InputUnit
                    type="number"
                    step="0.01"
                    min={0}
                    unit={unit}
                    placeholder="Liter in diesen Kanister"
                    value={litersById[c.id] ?? ""}
                    onChange={(e) => setLitersById((m) => ({ ...m, [c.id]: e.target.value }))}
                  />
                )}
              </div>
            );
          })}

          {/* derived car share + per-canister cost, posted via hidden fields */}
          <div className="rounded-md bg-background/40 p-2 text-sm">
            <div className="flex justify-between">
              <span>Ins Auto:</span>
              <span className={carLiters < 0 ? "text-destructive" : "font-medium"}>
                {carLiters.toFixed(2)} {unit} · {carCost.toFixed(2)} €
              </span>
            </div>
            {selected.map((c) => (
              <div key={c.id} className="flex justify-between text-muted-foreground">
                <span>{c.name}:</span>
                <span>{c.liters.toFixed(2)} {unit} · {r2(c.liters * p).toFixed(2)} €</span>
              </div>
            ))}
            {carLiters < 0 && (
              <p className="mt-1 text-xs text-destructive">
                Kanister-Mengen übersteigen die Gesamtmenge.
              </p>
            )}
          </div>

          <input type="hidden" name="amount" value={carLiters > 0 ? carLiters : ""} />
          <input type="hidden" name="totalCost" value={carLiters > 0 ? carCost : ""} />
          {selected.map((c) => (
            <span key={c.id}>
              <input type="hidden" name="canisterFillId" value={c.id} />
              <input type="hidden" name="canisterFillLiters" value={c.liters} />
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">Datum *</Label>
          <Input id="date" name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="odometer">Kilometerstand *</Label>
          <InputUnit id="odometer" name="odometer" type="number" min={0} required unit="km"
            value={odometer} onChange={(e) => setOdometer(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Menge *</Label>
          <InputUnit id="amount" name={withCan ? undefined : "amount"} type="number" step="0.01" min={0} required unit={unit}
            value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={fuelLabels[unit]} />
          {withCan && (
            <p className="text-xs text-muted-foreground">Gesamt an der Zapfsäule (Auto + Kanister)</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="pricePerUnit">Preis pro {unit}</Label>
          <InputUnit id="pricePerUnit" name="pricePerUnit" type="number" step="0.001" min={0} unit={`€/${unit}`}
            value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>

        {!withCan && (
          <div className="space-y-2">
            <Label htmlFor="totalCost">Gesamtpreis * (autom.)</Label>
            <InputUnit id="totalCost" name="totalCost" type="number" step="0.01" min={0} required unit="€"
              value={total} onChange={(e) => { setTotal(e.target.value); setTotalEdited(true); }} />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="station">Tankstelle</Label>
          <Input id="station" name="station" placeholder="z. B. Aral" value={station} onChange={(e) => setStation(e.target.value)} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isFullTank" checked={isFullTank} onChange={(e) => setIsFullTank(e.target.checked)} className="size-4 accent-[hsl(38_92%_55%)]" />
        Volltankung (für Verbrauchsberechnung)
      </label>

      {adblueEnabled && (
        <div className="space-y-2 rounded-lg border border-border/60 bg-background/30 p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={adblue}
              onChange={(e) => setAdblue(e.target.checked)}
              className="size-4 accent-[hsl(38_92%_55%)]"
            />
            Auch AdBlue getankt
          </label>
          {adblue && (
            <InputUnit
              name="adbluePrice"
              type="number"
              step="0.01"
              min={0}
              required
              unit="€"
              placeholder="Preis fürs AdBlue"
              value={adbluePrice}
              onChange={(e) => setAdbluePrice(e.target.value)}
            />
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="notes">Notizen</Label>
        <Textarea id="notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {!editing && vehicleId && (
        <div className="space-y-2">
          <SubmitButton className="w-full">Tankung hinzufügen</SubmitButton>
          <Button type="button" variant="outline" onClick={saveDraft} className="w-full">
            <Save className="mr-2 size-4" />
            Zwischenspeichern
          </Button>
          {draftMsg && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3.5 text-[hsl(142_70%_45%)]" />
              {draftMsg}
              <button type="button" onClick={discardDraft} className="underline hover:text-foreground">
                Verwerfen
              </button>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Speichert deine Eingaben auf diesem Gerät zwischen – z. B. während du
            bezahlen gehst. Beim Speichern der Tankung wird der Entwurf gelöscht.
          </p>
        </div>
      )}

      {(editing || !vehicleId) && (
        <SubmitButton>{editing ? "Speichern" : "Tankung hinzufügen"}</SubmitButton>
      )}
    </form>
  );
}

export type OdometerDefaults = {
  date: string;
  odometer: number;
  note: string | null;
};

export function OdometerForm({
  action,
  defaults,
  onDone,
}: {
  action: Action;
  defaults?: OdometerDefaults;
  onDone?: () => void;
}) {
  const editing = !!defaults;
  const [odometer, setOdometer] = useState(defaults ? String(defaults.odometer) : "");
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
        <Input id="note" name="note" defaultValue={defaults?.note ?? ""} />
      </div>
      <SubmitButton>{editing ? "Speichern" : "Eintrag hinzufügen"}</SubmitButton>
    </form>
  );
}

export type RepairDefaults = {
  date: string;
  category: string;
  title: string;
  cost: number;
  odometer: number | null;
  workshop: string | null;
  description: string | null;
  attachments: ExistingAttachment[];
};

export function RepairForm({
  action,
  defaults,
  onDone,
}: {
  action: Action;
  defaults?: RepairDefaults;
  onDone?: () => void;
}) {
  const editing = !!defaults;
  const { state, formAction, ref } = useResettingAction(action, onDone);
  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <AlertMessage error={state.error} success={state.success} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">Datum *</Label>
          <Input id="date" name="date" type="date" required defaultValue={defaults ? defaults.date : today()} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Kategorie</Label>
          <Select id="category" name="category" defaultValue={defaults?.category ?? "REPAIR"}>
            <option value="REPAIR">Reparatur</option>
            <option value="SERVICE">Inspektion / Service</option>
            <option value="INSPECTION">HU / AU (TÜV)</option>
            <option value="TIRES">Reifen</option>
            <option value="OTHER">Sonstiges</option>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Titel *</Label>
          <Input id="title" name="title" required placeholder="z. B. Bremsbeläge vorne" defaultValue={defaults?.title ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost">Kosten</Label>
          <InputUnit id="cost" name="cost" type="number" step="0.01" min={0} defaultValue={defaults?.cost ?? 0} unit="€" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="odometer">Kilometerstand</Label>
          <InputUnit id="odometer" name="odometer" type="number" min={0} unit="km" defaultValue={defaults?.odometer ?? ""} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="workshop">Werkstatt</Label>
          <Input id="workshop" name="workshop" defaultValue={defaults?.workshop ?? ""} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Beschreibung</Label>
        <Textarea id="description" name="description" defaultValue={defaults?.description ?? ""} />
      </div>
      <BeforeAfterImages editing={editing} />
      <MultiFilePicker
        name="attachments"
        label="Rechnungen & Belege (PDF, Bild)"
        existing={defaults?.attachments ?? []}
      />
      <SubmitButton>{editing ? "Speichern" : "Eintrag hinzufügen"}</SubmitButton>
    </form>
  );
}

export type CleaningDefaults = {
  date: string;
  type: string;
  cost: number;
  odometer: number | null;
  products: string | null;
  notes: string | null;
};

export function CleaningForm({
  action,
  defaults,
  onDone,
}: {
  action: Action;
  defaults?: CleaningDefaults;
  onDone?: () => void;
}) {
  const editing = !!defaults;
  const { state, formAction, ref } = useResettingAction(action, onDone);
  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <AlertMessage error={state.error} success={state.success} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">Datum *</Label>
          <Input id="date" name="date" type="date" required defaultValue={defaults ? defaults.date : today()} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Art</Label>
          <Select id="type" name="type" defaultValue={defaults?.type ?? "FULL"}>
            <option value="FULL">Komplett</option>
            <option value="EXTERIOR">Außen</option>
            <option value="INTERIOR">Innen</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost">Kosten</Label>
          <InputUnit id="cost" name="cost" type="number" step="0.01" min={0} defaultValue={defaults?.cost ?? 0} unit="€" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="odometer">Kilometerstand</Label>
          <InputUnit id="odometer" name="odometer" type="number" min={0} unit="km" defaultValue={defaults?.odometer ?? ""} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="products">Verwendete Produkte</Label>
          <Input id="products" name="products" placeholder="z. B. Hartwachs, Felgenreiniger" defaultValue={defaults?.products ?? ""} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notizen</Label>
        <Textarea id="notes" name="notes" defaultValue={defaults?.notes ?? ""} />
      </div>
      <BeforeAfterImages editing={editing} />
      <SubmitButton>{editing ? "Speichern" : "Eintrag hinzufügen"}</SubmitButton>
    </form>
  );
}

/* ---------------- Canisters ---------------- */

export function CanisterCreateForm({ action }: { action: Action }) {
  const { state, formAction, ref } = useResettingAction(action);
  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <AlertMessage error={state.error} success={state.success} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="c-name">Name *</Label>
          <Input id="c-name" name="name" required placeholder="z. B. Reservekanister" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-capacity">Füllvermögen *</Label>
          <InputUnit id="c-capacity" name="capacity" type="number" step="0.1" min={0} required unit="L" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-fuelType">Spritsorte</Label>
          <Select id="c-fuelType" name="fuelType" defaultValue="">
            <option value="">— egal —</option>
            <option value="PETROL">Benzin</option>
            <option value="DIESEL">Diesel</option>
            <option value="LPG">LPG</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-notes">Notiz</Label>
          <Input id="c-notes" name="notes" />
        </div>
      </div>
      <SubmitButton>Kanister anlegen</SubmitButton>
    </form>
  );
}

export function CanisterFillForm({ action, unit }: { action: Action; unit: "L" | "kWh" }) {
  const [liters, setLiters] = useState("");
  const [price, setPrice] = useState("");
  const [total, setTotal] = useState("");
  const [totalEdited, setTotalEdited] = useState(false);
  const { state, formAction, ref } = useResettingAction(action, () => {
    setLiters("");
    setPrice("");
    setTotal("");
    setTotalEdited(false);
  });
  useEffect(() => {
    if (totalEdited) return;
    const a = parseFloat(liters.replace(",", "."));
    const p = parseFloat(price.replace(",", "."));
    if (!isNaN(a) && !isNaN(p)) setTotal((a * p).toFixed(2));
  }, [liters, price, totalEdited]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <AlertMessage error={state.error} success={state.success} />
      <FuelPumpCapture
        onDetect={({ amount: a, price: p }) => {
          if (a !== undefined) setLiters(a);
          if (p !== undefined) {
            setPrice(p);
            setTotalEdited(false);
          }
        }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ff-date">Datum *</Label>
          <Input id="ff-date" name="date" type="date" required defaultValue={today()} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ff-station">Tankstelle</Label>
          <Input id="ff-station" name="station" placeholder="z. B. Aral" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ff-liters">Menge *</Label>
          <InputUnit id="ff-liters" name="liters" type="number" step="0.01" min={0} required unit={unit}
            value={liters} onChange={(e) => setLiters(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ff-price">Preis pro {unit}</Label>
          <InputUnit id="ff-price" name="pricePerUnit" type="number" step="0.001" min={0} unit={`€/${unit}`}
            value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ff-total">Gesamtpreis * (autom.)</Label>
          <InputUnit id="ff-total" name="totalCost" type="number" step="0.01" min={0} required unit="€"
            value={total} onChange={(e) => { setTotal(e.target.value); setTotalEdited(true); }} />
        </div>
      </div>
      <SubmitButton>Kanister befüllen</SubmitButton>
    </form>
  );
}

export function CanisterPourForm({
  action,
  canisters,
  unit,
}: {
  action: Action;
  canisters: { id: string; name: string; liters: number }[];
  unit: "L" | "kWh";
}) {
  const [odometer, setOdometer] = useState("");
  const [canisterId, setCanisterId] = useState(canisters[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [amountEdited, setAmountEdited] = useState(false);
  const { state, formAction, ref } = useResettingAction(action, () => {
    setOdometer("");
    setAmountEdited(false);
  });

  const selectedCan = canisters.find((c) => c.id === canisterId) ?? canisters[0];

  // Default the amount to the selected canister's available litres (fill the
  // tank to what's there), until the user edits it.
  useEffect(() => {
    if (amountEdited) return;
    setAmount(selectedCan ? String(selectedCan.liters) : "");
  }, [selectedCan?.id, selectedCan?.liters, amountEdited]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <AlertMessage error={state.error} success={state.success} />
      <OdometerCapture onDetect={setOdometer} />
      <div className="space-y-2">
        <Label htmlFor="p-canister">Kanister *</Label>
        <Select
          id="p-canister"
          name="canisterId"
          required
          value={canisterId}
          onChange={(e) => {
            setCanisterId(e.target.value);
            setAmountEdited(false);
          }}
        >
          {canisters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.liters.toFixed(1)} {unit} verfügbar
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="p-date">Datum *</Label>
          <Input id="p-date" name="date" type="date" required defaultValue={today()} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-odometer">Kilometerstand *</Label>
          <InputUnit id="p-odometer" name="odometer" type="number" min={0} required unit="km"
            value={odometer} onChange={(e) => setOdometer(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="p-amount">Menge ins Auto *</Label>
          <InputUnit id="p-amount" name="amount" type="number" step="0.01" min={0} required unit={unit}
            value={amount} onChange={(e) => { setAmount(e.target.value); setAmountEdited(true); }} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isFullTank" className="size-4 accent-[hsl(38_92%_55%)]" />
        Volltankung (für Verbrauchsberechnung)
      </label>
      <p className="text-xs text-muted-foreground">
        Kosten werden automatisch aus dem Ø-Preis des Kanisters berechnet.
      </p>
      <SubmitButton>Aus Kanister nachfüllen</SubmitButton>
    </form>
  );
}
