import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/** Require a logged-in user, or redirect to /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Require an admin user, or redirect. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/**
 * Load a vehicle owned by the current user, or return null.
 * Enforces per-user data isolation. Use this for owner-only operations
 * (settings, delete, sharing, animation, export).
 */
export async function getOwnedVehicle(vehicleId: string, userId: string) {
  return db.vehicle.findFirst({
    where: { id: vehicleId, userId },
  });
}

/** Like getOwnedVehicle but redirects home (404-ish) when not found. */
export async function requireOwnedVehicle(vehicleId: string, userId: string) {
  const vehicle = await getOwnedVehicle(vehicleId, userId);
  if (!vehicle) redirect("/");
  return vehicle;
}

export type VehicleAccessLevel = "OWNER" | "EDITOR" | "VIEWER";

/**
 * Prisma where-fragment matching every vehicle a user may at least view:
 * the ones they own plus the ones shared with them.
 */
export function vehicleAccessWhere(userId: string) {
  return {
    OR: [{ userId }, { shares: { some: { userId } } }],
  };
}

/**
 * Resolve a user's access to a vehicle. Returns the access level and the
 * vehicle's actual owner id (used to scope owner-level resources like
 * canisters), or null if the user has no access at all.
 */
export async function getVehicleAccess(
  vehicleId: string,
  userId: string
): Promise<{ level: VehicleAccessLevel; ownerId: string } | null> {
  const vehicle = await db.vehicle.findFirst({
    where: { id: vehicleId, ...vehicleAccessWhere(userId) },
    select: {
      userId: true,
      shares: { where: { userId }, select: { role: true } },
    },
  });
  if (!vehicle) return null;
  const level: VehicleAccessLevel =
    vehicle.userId === userId
      ? "OWNER"
      : vehicle.shares[0]?.role === "EDITOR"
        ? "EDITOR"
        : "VIEWER";
  return { level, ownerId: vehicle.userId };
}

/** Require at least view access to a vehicle, or redirect home. */
export async function requireVehicleAccess(vehicleId: string, userId: string) {
  const access = await getVehicleAccess(vehicleId, userId);
  if (!access) redirect("/");
  return access;
}
