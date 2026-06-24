"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { AlertMessage } from "@/components/ui/alert-message";
import {
  MultiFilePicker,
  type ExistingAttachment,
} from "@/components/forms/multi-file-picker";

type State = { error?: string; success?: string };
type Action = (prev: State, formData: FormData) => Promise<State>;

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

export type DocumentDefaults = {
  title: string;
  category: string;
  issueDate: Date | string | null;
  expiresAt: Date | string | null;
  notes: string | null;
  remind: boolean;
  leadDays: number;
  files: ExistingAttachment[];
};

export function DocumentForm({
  action,
  defaults,
  onDone,
}: {
  action: Action;
  defaults?: DocumentDefaults;
  onDone?: () => void;
}) {
  const editing = !!defaults;
  const { state, formAction, ref } = useResettingAction(action, onDone);
  const [remind, setRemind] = useState(defaults?.remind ?? false);

  return (
    <form ref={ref} action={formAction} className="space-y-4">
      <AlertMessage error={state.error} success={state.success} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Titel *</Label>
          <Input
            id="title"
            name="title"
            required
            placeholder="z. B. Versicherungspolice 2026"
            defaultValue={defaults?.title ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Kategorie</Label>
          <Select id="category" name="category" defaultValue={defaults?.category ?? "OTHER"}>
            <option value="REGISTRATION">Zulassung / Fahrzeugschein</option>
            <option value="INSURANCE">Versicherung</option>
            <option value="LICENSE">Führerschein</option>
            <option value="WARRANTY">Garantie</option>
            <option value="INVOICE">Rechnung / Kaufvertrag</option>
            <option value="OTHER">Sonstiges</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="issueDate">Ausgestellt am</Label>
          <Input
            id="issueDate"
            name="issueDate"
            type="date"
            defaultValue={defaults?.issueDate ? toDateInput(defaults.issueDate) : ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiresAt">Gültig bis / Ablauf</Label>
          <Input
            id="expiresAt"
            name="expiresAt"
            type="date"
            defaultValue={defaults?.expiresAt ? toDateInput(defaults.expiresAt) : ""}
          />
        </div>
      </div>

      <label className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/30 p-3 text-sm">
        <input
          type="checkbox"
          name="remind"
          checked={remind}
          onChange={(e) => setRemind(e.target.checked)}
          className="mt-0.5 size-4 accent-[hsl(38_92%_55%)]"
        />
        <span>
          <span className="font-medium">An Ablauf erinnern</span>
          <span className="block text-xs text-muted-foreground">
            Erstellt automatisch einen Termin und benachrichtigt dich rechtzeitig
            vor dem Ablaufdatum (nur mit gesetztem „Gültig bis").
          </span>
        </span>
      </label>
      {remind && (
        <div className="space-y-2">
          <Label htmlFor="leadDays">Vorlaufzeit (Tage)</Label>
          <Input
            id="leadDays"
            name="leadDays"
            type="number"
            min={0}
            max={365}
            defaultValue={defaults?.leadDays ?? 28}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notiz</Label>
        <Textarea id="notes" name="notes" defaultValue={defaults?.notes ?? ""} />
      </div>

      <MultiFilePicker name="files" label="Dateien (PDF, Bild)" existing={defaults?.files ?? []} />

      <SubmitButton>{editing ? "Speichern" : "Dokument hinzufügen"}</SubmitButton>
    </form>
  );
}
