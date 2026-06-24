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

export type TripDefaults = {
  date: string;
  startOdometer: number;
  endOdometer: number;
  purpose: string;
  startLocation: string | null;
  endLocation: string | null;
  description: string | null;
};

export function TripForm({
  action,
  defaults,
  defaultStartOdometer,
  onDone,
}: {
  action: Action;
  defaults?: TripDefaults;
  // Pre-fill the start km for a new trip (e.g. the last trip's end km).
  defaultStartOdometer?: number;
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
          <Label htmlFor="purpose">Zweck</Label>
          <Select id="purpose" name="purpose" defaultValue={defaults?.purpose ?? "BUSINESS"}>
            <option value="BUSINESS">Geschäftlich</option>
            <option value="PRIVATE">Privat</option>
            <option value="COMMUTE">Arbeitsweg</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="startOdometer">Start-km *</Label>
          <InputUnit
            id="startOdometer"
            name="startOdometer"
            type="number"
            min={0}
            required
            unit="km"
            defaultValue={defaults?.startOdometer ?? defaultStartOdometer ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endOdometer">End-km *</Label>
          <InputUnit
            id="endOdometer"
            name="endOdometer"
            type="number"
            min={0}
            required
            unit="km"
            defaultValue={defaults?.endOdometer ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startLocation">Von</Label>
          <Input
            id="startLocation"
            name="startLocation"
            placeholder="z. B. München"
            defaultValue={defaults?.startLocation ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endLocation">Nach</Label>
          <Input
            id="endLocation"
            name="endLocation"
            placeholder="z. B. Stuttgart"
            defaultValue={defaults?.endLocation ?? ""}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Zweck / Notiz</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="z. B. Kundentermin Firma XY"
          defaultValue={defaults?.description ?? ""}
        />
      </div>
      <SubmitButton>{editing ? "Speichern" : "Fahrt hinzufügen"}</SubmitButton>
    </form>
  );
}
