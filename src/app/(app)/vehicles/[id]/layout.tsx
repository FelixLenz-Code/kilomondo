import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser, requireOwnedVehicle } from "@/lib/auth/guards";
import { VehicleTabs } from "@/components/vehicle-tabs";
import { VehicleMedia } from "@/components/vehicle-media";
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
          </>
        )}
      </div>
      <VehicleTabs vehicleId={id} />
      <div>{children}</div>
    </div>
  );
}
