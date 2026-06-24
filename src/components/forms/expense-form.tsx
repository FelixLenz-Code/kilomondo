"use client";

import { useActionState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { InputUnit } from "@/components/ui/input-unit";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { AlertMessage } from "@/components/ui/alert-message";

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

export type ExpenseDefaults = {
  date: string;
  category: string;
  title: string | null;
  amount: number;
  notes: string | null;
};

export function ExpenseForm({
  action,
  defaults,
  onDone,
}: {
  action: Action;
  defaults?: ExpenseDefaults;
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
          <Select id="category" name="category" defaultValue={defaults?.category ?? "TAX"}>
            <option value="TAX">Kfz-Steuer</option>
            <option value="INSURANCE">Versicherung</option>
            <option value="FEE">Gebühren</option>
            <option value="OTHER">Sonstiges</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Betrag *</Label>
          <InputUnit
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min={0}
            required
            unit="€"
            defaultValue={defaults?.amount ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Bezeichnung</Label>
          <Input
            id="title"
            name="title"
            placeholder="z. B. Haftpflicht 2026"
            defaultValue={defaults?.title ?? ""}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notiz</Label>
        <Textarea id="notes" name="notes" defaultValue={defaults?.notes ?? ""} />
      </div>
      <SubmitButton>{editing ? "Speichern" : "Kosten hinzufügen"}</SubmitButton>
    </form>
  );
}
