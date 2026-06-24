"use client";

import { useActionState, useRef } from "react";
import { Upload } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { AlertMessage } from "@/components/ui/alert-message";

type State = { error?: string; success?: string };
type Action = (prev: State, formData: FormData) => Promise<State>;

export function FuelCsvImport({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={(fd) => {
        formAction(fd);
      }}
      className="space-y-3"
    >
      <AlertMessage error={state.error} success={state.success} />
      <p className="text-xs text-muted-foreground">
        CSV-Export aus Spritmonitor oder Fuelio. Spalten für Datum, Kilometerstand
        und Menge werden automatisch erkannt; Preis/Gesamt wird bei Bedarf berechnet.
      </p>
      <input
        type="file"
        name="csv"
        accept=".csv,text/csv"
        required
        className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-secondary/80"
      />
      <SubmitButton>
        <Upload className="size-4" /> CSV importieren
      </SubmitButton>
    </form>
  );
}
