import Link from "next/link";
import { Car, Plus, Gauge } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatKm } from "@/lib/utils";

const fuelTypeLabel: Record<string, string> = {
  PETROL: "Benzin",
  DIESEL: "Diesel",
  ELECTRIC: "Elektro",
  HYBRID: "Hybrid",
  LPG: "LPG",
};

export default async function GaragePage() {
  const user = await requireUser();
  const vehicles = await db.vehicle.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      fuelEntries: { select: { odometer: true } },
      odometerEntries: { select: { odometer: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Deine Garage
          </h1>
          <p className="mt-1 text-muted-foreground">
            {vehicles.length === 0
              ? "Noch keine Fahrzeuge angelegt."
              : `${vehicles.length} Fahrzeug${vehicles.length === 1 ? "" : "e"}`}
          </p>
        </div>
        <Link href="/vehicles/new" className={buttonVariants()}>
          <Plus className="size-4" /> Fahrzeug
        </Link>
      </div>

      {vehicles.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Car className="size-8" />
            </span>
            <div>
              <p className="font-display text-lg font-medium">
                Lege dein erstes Fahrzeug an
              </p>
              <p className="text-sm text-muted-foreground">
                Erfasse danach Tankungen, Reparaturen und Pflege.
              </p>
            </div>
            <Link href="/vehicles/new" className={buttonVariants()}>
              <Plus className="size-4" /> Fahrzeug hinzufügen
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => {
            const current = Math.max(
              v.initialOdometer,
              ...v.fuelEntries.map((f) => f.odometer),
              ...v.odometerEntries.map((o) => o.odometer),
              0
            );
            return (
              <Link key={v.id} href={`/vehicles/${v.id}`} className="group">
                <Card className="glass h-full overflow-hidden transition-colors group-hover:border-primary/40">
                  {v.coverImageId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/images/${v.coverImageId}`}
                      alt={v.name}
                      className="h-40 w-full object-cover"
                    />
                  )}
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-start justify-between">
                      {!v.coverImageId && (
                        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                          <Car className="size-5" />
                        </span>
                      )}
                      <Badge variant="secondary" className="ml-auto">
                        {fuelTypeLabel[v.fuelType]}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-display text-lg font-semibold">{v.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[v.make, v.model, v.year].filter(Boolean).join(" ") ||
                          "Keine Details"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Gauge className="size-4" />
                      {formatKm(current)}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
