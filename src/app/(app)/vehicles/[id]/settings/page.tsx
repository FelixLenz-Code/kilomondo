import { redirect } from "next/navigation";
import { Download, FileText, Users, Table, CarFront, AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { updateVehicleAction, deleteVehicleAction } from "@/actions/vehicles";
import { upsertLeasingAction, deleteLeasingAction } from "@/actions/leasing";
import { leasingStatus } from "@/lib/leasing";
import { VehicleForm } from "@/components/forms/vehicle-form";
import { LeasingForm } from "@/components/forms/leasing-form";
import { VehicleShare } from "@/components/vehicle-share";
import { DeleteButton } from "@/components/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatDate, formatKm } from "@/lib/utils";

export default async function VehicleSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  // Settings (incl. sharing/export/delete) are owner-only.
  const vehicle = await db.vehicle.findFirst({ where: { id, userId: user.id } });
  if (!vehicle) redirect("/");

  // Leasing section (optional, owner-managed). Compute the km budget status
  // from the current odometer when a contract exists.
  let leasing: Awaited<ReturnType<typeof db.leasingContract.findUnique>> = null;
  let leasingState: ReturnType<typeof leasingStatus> | null = null;
  if (vehicle.leasingTracking) {
    leasing = await db.leasingContract.findUnique({ where: { vehicleId: id } });
    if (leasing) {
      const [fuelMax, odoMax] = await Promise.all([
        db.fuelEntry.aggregate({ where: { vehicleId: id }, _max: { odometer: true } }),
        db.odometerEntry.aggregate({ where: { vehicleId: id }, _max: { odometer: true } }),
      ]);
      const currentOdometer = Math.max(
        vehicle.initialOdometer,
        fuelMax._max.odometer ?? 0,
        odoMax._max.odometer ?? 0
      );
      leasingState = leasingStatus(leasing, currentOdometer);
    }
  }

  const shareRows = await db.vehicleShare.findMany({
    where: { vehicleId: id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  const shares = shareRows.map((s) => ({
    id: s.user.id,
    name: s.user.name,
    email: s.user.email,
    role: s.role,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Fahrzeugdaten</CardTitle>
        </CardHeader>
        <CardContent>
          <VehicleForm
            action={updateVehicleAction.bind(null, id)}
            vehicle={vehicle}
            submitLabel="Änderungen speichern"
          />
        </CardContent>
      </Card>

      {vehicle.leasingTracking && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CarFront className="size-5" /> Leasing / Finanzierung
            </CardTitle>
            <CardDescription>
              Vertragsdaten und km-Budget. Die Prognose schätzt anhand des aktuellen
              Kilometerstands, ob du am Vertragsende über dem Limit liegst.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {leasing && leasingState && (
              <div className="space-y-3 rounded-lg border border-border/60 bg-background/30 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Laufzeit</p>
                    <p className="font-medium">
                      {formatDate(leasing.startDate)} – {formatDate(leasing.endDate)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      noch {Math.ceil(leasingState.remainingDays)} Tage
                    </p>
                  </div>
                  {leasing.monthlyRate != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Monatsrate</p>
                      <p className="font-medium">{formatCurrency(leasing.monthlyRate)}</p>
                    </div>
                  )}
                </div>

                {leasingState.totalKmAllowed != null ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">km-Budget</span>
                      <span className="font-medium">
                        {formatKm(leasingState.drivenSinceStart)} / {formatKm(leasingState.totalKmAllowed)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={leasingState.overBudgetNow ? "h-full bg-destructive" : "h-full bg-primary"}
                        style={{
                          width: `${Math.min(100, leasingState.totalKmAllowed > 0 ? (leasingState.drivenSinceStart / leasingState.totalKmAllowed) * 100 : 0)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Hochrechnung bis Vertragsende: ~{formatKm(leasingState.projectedTotal)}
                    </p>
                    {leasingState.projectedExcess != null && leasingState.projectedExcess > 0 && (
                      <p className="flex items-center gap-1.5 text-sm text-destructive">
                        <AlertTriangle className="size-4" />
                        Voraussichtlich ~{formatKm(leasingState.projectedExcess)} über dem Limit
                        {leasingState.projectedExcessCost != null
                          ? ` (≈ ${formatCurrency(leasingState.projectedExcessCost)} Mehrkosten)`
                          : ""}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Trage ein km-Limit pro Jahr ein, um eine Budget-Prognose zu sehen.
                  </p>
                )}
              </div>
            )}

            <LeasingForm
              action={upsertLeasingAction.bind(null, id)}
              defaults={
                leasing
                  ? {
                      provider: leasing.provider,
                      monthlyRate: leasing.monthlyRate,
                      downPayment: leasing.downPayment,
                      startDate: leasing.startDate,
                      endDate: leasing.endDate,
                      startOdometer: leasing.startOdometer,
                      annualKmLimit: leasing.annualKmLimit,
                      excessKmCost: leasing.excessKmCost,
                      notes: leasing.notes,
                    }
                  : undefined
              }
            />
            {leasing && (
              <DeleteButton
                action={deleteLeasingAction.bind(null, id)}
                confirmText="Leasing-Daten wirklich löschen?"
                label="Leasing-Daten löschen"
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" /> Teilen
          </CardTitle>
          <CardDescription>
            Gib anderen Nutzern Zugriff auf dieses Fahrzeug. <strong>Bearbeiter</strong>{" "}
            können Tankungen, Kilometer, Reparaturen und Pflege erfassen;{" "}
            <strong>Betrachter</strong> sehen nur. Einstellungen, Teilen und Löschen
            bleiben dir vorbehalten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VehicleShare vehicleId={id} initialShares={shares} />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>
            <strong>PDF-Übersicht:</strong> druckfreundliche Zusammenfassung mit Kennzahlen
            und allen Einträgen. <strong>CSV:</strong> alle Einträge als Tabellen (eine
            CSV-Datei je Bereich) zum Öffnen in Excel/Calc. <strong>ZIP:</strong> komplettes
            Backup mit Daten, Bildern und 3D-Animation — über „Importieren" in der Garage
            wieder einspielbar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <a
            href={`/vehicles/${id}/report`}
            className={buttonVariants({ variant: "outline" })}
            target="_blank"
            rel="noreferrer"
          >
            <FileText className="size-4" /> PDF-Übersicht
          </a>
          <a
            href={`/vehicles/${id}/csv`}
            className={buttonVariants({ variant: "outline" })}
            download
          >
            <Table className="size-4" /> Als CSV exportieren
          </a>
          <a
            href={`/vehicles/${id}/export`}
            className={buttonVariants({ variant: "outline" })}
            download
          >
            <Download className="size-4" /> Als ZIP exportieren
          </a>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Fahrzeug löschen</CardTitle>
          <CardDescription>
            Löscht das Fahrzeug samt aller Tankungen, Reparaturen und Pflege-Einträge.
            Dies kann nicht rückgängig gemacht werden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteButton
            action={deleteVehicleAction.bind(null, id)}
            confirmText={`„${vehicle.name}" mit allen Daten wirklich löschen?`}
            label="Fahrzeug unwiderruflich löschen"
          />
        </CardContent>
      </Card>
    </div>
  );
}
