import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser, requireOwnedVehicle } from "@/lib/auth/guards";
import { VehicleTabs } from "@/components/vehicle-tabs";

export default async function VehicleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const vehicle = await requireOwnedVehicle(id, user.id);

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Garage
        </Link>
        {vehicle.coverImageId ? (
          <div className="relative mt-2 overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/images/${vehicle.coverImageId}`}
              alt={vehicle.name}
              className="h-48 w-full object-cover sm:h-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
            <div className="absolute bottom-0 left-0 p-5">
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {vehicle.name}
              </h1>
              <p className="text-muted-foreground">
                {[vehicle.make, vehicle.model, vehicle.year]
                  .filter(Boolean)
                  .join(" ") || "Keine weiteren Details"}
              </p>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
              {vehicle.name}
            </h1>
            <p className="text-muted-foreground">
              {[vehicle.make, vehicle.model, vehicle.year]
                .filter(Boolean)
                .join(" ") || "Keine weiteren Details"}
            </p>
          </>
        )}
      </div>
      <VehicleTabs vehicleId={id} />
      <div>{children}</div>
    </div>
  );
}
