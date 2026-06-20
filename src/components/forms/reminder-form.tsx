"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { InputUnit } from "@/components/ui/input-unit";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { AlertMessage } from "@/components/ui/alert-message";

type State = { error?: string; success?: string };
type Action = (prev: State, formData: FormData) => Promise<State>;

const TYPE_LABEL: Record<string, string> = {
  INSPECTION: "HU/AU (TÜV)",
  SERVICE: "Wartung / Inspektion",
  INSURANCE: "Versicherung",
  TAX: "Kfz-Steuer",
  LOG: "Eintragen-Erinnerung",
  CUSTOM: "Sonstiges",
};

// Sensible default title + recurrence when a type is picked.
const TYPE_DEFAULTS: Record<string, { title: string; recurrence?: number }> = {
  INSPECTION: { title: "HU/AU (TÜV)", recurrence: 24 },
  SERVICE: { title: "Wartung / Inspektion", recurrence: 12 },
  INSURANCE: { title: "Versicherung", recurrence: 12 },
  TAX: { title: "Kfz-Steuer", recurrence: 12 },
  LOG: { title: "Eintragen nicht vergessen" },
  CUSTOM: { title: "" },
};

export function ReminderForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  const [type, setType] = useState("INSPECTION");
  const [title, setTitle] = useState(TYPE_DEFAULTS.INSPECTION.title);
  const [recurrence, setRecurrence] = useState(String(TYPE_DEFAULTS.INSPECTION.recurrence ?? ""));

  useEffect(() => {
    if (state.success) {
      ref.current?.reset();
      setType("INSPECTION");
      setTitle(TYPE_DEFAULTS.INSPECTION.title);
      setRecurrence(String(TYPE_DEFAULTS.INSPECTION.recurrence ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  function onTypeChange(next: string) {
    setType(next);
    const def = TYPE_DEFAULTS[next];
    setTitle(def.title);
    setRecurrence(String(def.recurrence ?? ""));
  }

  const isLog = type === "LOG";

  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <AlertMessage error={state.error} success={state.success} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Art</Label>
          <Select id="type" name="type" value={type} onChange={(e) => onTypeChange(e.target.value)}>
            {Object.entries(TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Titel *</Label>
          <Input id="title" name="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {isLog ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="intervalDays">Erinnern, wenn länger nichts eingetragen wurde</Label>
            <InputUnit id="intervalDays" name="intervalDays" type="number" min={1} unit="Tage" defaultValue={30} />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Fällig am</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueOdometer">…oder bei km-Stand</Label>
              <InputUnit id="dueOdometer" name="dueOdometer" type="number" min={0} unit="km" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leadDays">Vorlauf</Label>
              <InputUnit id="leadDays" name="leadDays" type="number" min={0} unit="Tage" defaultValue={28} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurrenceMonths">Wiederholung (optional)</Label>
              <InputUnit id="recurrenceMonths" name="recurrenceMonths" type="number" min={1} unit="Monate"
                value={recurrence} onChange={(e) => setRecurrence(e.target.value)} />
            </div>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {isLog
          ? "Du wirst erinnert, wenn seit der angegebenen Zahl an Tagen keine Tankung, Kilometer-, Reparatur- oder Pflege-Erfassung erfolgt ist."
          : "Du wirst rechtzeitig vor dem Datum (bzw. beim Erreichen des km-Stands) benachrichtigt. Mit Wiederholung rollt das Datum nach Fälligkeit automatisch weiter."}
      </p>
      <SubmitButton>Erinnerung hinzufügen</SubmitButton>
    </form>
  );
}
