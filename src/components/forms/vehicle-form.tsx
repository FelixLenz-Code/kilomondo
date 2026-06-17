"use client";

import { useActionState } from "react";
import type { Vehicle } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { AlertMessage } from "@/components/ui/alert-message";
import { ImagePicker } from "@/components/forms/image-picker";

type State = { error?: string };

export function VehicleForm({
  action,
  vehicle,
  submitLabel = "Speichern",
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  vehicle?: Vehicle;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5">
      <AlertMessage error={state.error} />

      <div className="space-y-2">
        <Label htmlFor="name">Bezeichnung *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={vehicle?.name}
          placeholder="z. B. Mein Alltagswagen"
        />
      </div>

      <ImagePicker
        name="coverImage"
        label="Startseitenbild"
        existingImageId={vehicle?.coverImageId}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="make">Marke</Label>
          <Input id="make" name="make" defaultValue={vehicle?.make ?? ""} placeholder="BMW" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">Modell</Label>
          <Input id="model" name="model" defaultValue={vehicle?.model ?? ""} placeholder="320d" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="year">Baujahr</Label>
          <Input
            id="year"
            name="year"
            type="number"
            defaultValue={vehicle?.year ?? ""}
            placeholder="2020"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fuelType">Antrieb</Label>
          <Select id="fuelType" name="fuelType" defaultValue={vehicle?.fuelType ?? "PETROL"}>
            <option value="PETROL">Benzin</option>
            <option value="DIESEL">Diesel</option>
            <option value="ELECTRIC">Elektro</option>
            <option value="HYBRID">Hybrid</option>
            <option value="LPG">LPG / Autogas</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="licensePlate">Kennzeichen</Label>
          <Input
            id="licensePlate"
            name="licensePlate"
            defaultValue={vehicle?.licensePlate ?? ""}
            placeholder="M-AB 1234"
            className="uppercase placeholder:normal-case"
            onChange={(e) => {
              e.target.value = e.target.value.toUpperCase();
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="color">Farbe</Label>
          <Input id="color" name="color" defaultValue={vehicle?.color ?? ""} placeholder="Schwarz" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vin">FIN / VIN</Label>
          <Input id="vin" name="vin" defaultValue={vehicle?.vin ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="initialOdometer">Anfangs-Kilometerstand</Label>
          <Input
            id="initialOdometer"
            name="initialOdometer"
            type="number"
            min={0}
            defaultValue={vehicle?.initialOdometer ?? 0}
          />
        </div>
      </div>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
