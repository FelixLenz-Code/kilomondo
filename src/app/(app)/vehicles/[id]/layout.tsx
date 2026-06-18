import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { requireUser, requireVehicleAccess } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { VehicleTabs } from "@/components/vehicle-tabs";
import { VehicleMedia } from "@/components/vehicle-media";
import { Badge } from "@/components/ui/badge";
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
        {hasVehicleMedia(vehicle) ? (
          // Title and media sit side by side on desktop (car to the right, using
          // the wide space) and stack on mobile (car on top, title below) so the
          // text never overlaps the car.
          <div className="mt-2 grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-[#121418] sm:grid-cols-[1fr_1.3fr]">
            <div className="order-2 flex flex-col justify-center p-5 sm:order-1">
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {vehicle.name}
              </h1>
              <p className="text-muted-foreground">
                {[vehicle.make, vehicle.model, vehicle.year]
                  .filter(Boolean)
                  .join(" ") || "Keine weiteren Details"}
              </p>
              {owner && (
                <Badge variant="secondary" className="mt-2 w-fit gap-1">
                  <Users className="size-3" /> Geteilt von {owner.name}
                </Badge>
              )}
            </div>
            <div className="order-1 h-56 sm:order-2 sm:h-72">
              <VehicleMedia
                status={vehicle.animationStatus}
                videoId={vehicle.animationVideoId}
                posterId={vehicle.animationPosterId}
                coverImageId={vehicle.coverImageId}
                alt={vehicle.name}
                className="size-full object-cover"
              />
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
            {owner && (
              <Badge variant="secondary" className="mt-2 w-fit gap-1">
                <Users className="size-3" /> Geteilt von {owner.name}
              </Badge>
            )}
          </>
        )}
      </div>
      <VehicleTabs vehicleId={id} showSettings={isOwner} />
      <div>{children}</div>
    </div>
  );
}
