import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser, requireVehicleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { VehicleTabs } from "@/components/vehicle-tabs";
import { VehicleHeader } from "@/components/vehicle-header";
import { hasVehicleMedia } from "@/lib/vehicle-media";

export default async function VehicleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const access = await requireVehicleAccess(id, user.id);
  const isOwner = access.level === "OWNER";
  const vehicle = await db.vehicle.findUniqueOrThrow({ where: { id } });
  // For a shared vehicle, show whose it is.
  const owner = isOwner
    ? null
    : await db.user.findUnique({
        where: { id: access.ownerId },
        select: { name: true },
      });

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Garage
        </Link>
        <VehicleHeader
          id={id}
          name={vehicle.name}
          subtitle={
            [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") ||
            "Keine weiteren Details"
          }
          ownerName={owner?.name ?? null}
          media={
            hasVehicleMedia(vehicle)
              ? {
                  status: vehicle.animationStatus,
                  videoId: vehicle.animationVideoId,
                  posterId: vehicle.animationPosterId,
                  coverImageId: vehicle.coverImageId,
                }
              : null
          }
        />
      </div>
      <VehicleTabs
        vehicleId={id}
        showSettings={isOwner}
        features={{
          tires: vehicle.tireTracking,
          trips: vehicle.tripLogging,
          charging: vehicle.evTracking,
          // Pure EV (charging on, not a hybrid) hides the fuel tab; hybrids keep
          // both fuel and charging.
          fuel: !vehicle.evTracking || vehicle.fuelType === "HYBRID",
        }}
      />
      <div>{children}</div>
    </div>
  );
}
