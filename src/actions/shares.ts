"use server";

import { revalidatePath } from "next/cache";
import type { ShareRole } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser, getOwnedVehicle } from "@/lib/auth/guards";

export type ShareUser = { id: string; name: string; email: string };
export type VehicleShareView = ShareUser & { role: ShareRole };

/** Only the owner may manage a vehicle's shares. Returns the owner id. */
async function requireOwner(vehicleId: string): Promise<string> {
  const user = await requireUser();
  const owned = await getOwnedVehicle(vehicleId, user.id);
  if (!owned) throw new Error("forbidden");
  return user.id;
}

function normalizeRole(role: string): ShareRole {
  return role === "VIEWER" ? "VIEWER" : "EDITOR";
}

/**
 * Find active users to share a vehicle with, by name or email. Excludes the
 * owner and anyone the vehicle is already shared with.
 */
export async function searchUsersAction(
  vehicleId: string,
  query: string
): Promise<ShareUser[]> {
  const ownerId = await requireOwner(vehicleId);
  const q = query.trim();
  if (q.length < 2) return [];

  const existing = await db.vehicleShare.findMany({
    where: { vehicleId },
    select: { userId: true },
  });
  const excludeIds = [ownerId, ...existing.map((e) => e.userId)];

  return db.user.findMany({
    where: {
      isActive: true,
      id: { notIn: excludeIds },
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true },
    orderBy: { email: "asc" },
    take: 8,
  });
}

export async function shareVehicleAction(
  vehicleId: string,
  targetUserId: string,
  role: string
): Promise<{ error?: string }> {
  const ownerId = await requireOwner(vehicleId);
  if (targetUserId === ownerId) return { error: "Sich selbst teilen geht nicht." };

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, isActive: true },
  });
  if (!target || !target.isActive) return { error: "Nutzer nicht gefunden." };

  await db.vehicleShare.upsert({
    where: { vehicleId_userId: { vehicleId, userId: targetUserId } },
    create: { vehicleId, userId: targetUserId, role: normalizeRole(role) },
    update: { role: normalizeRole(role) },
  });
  revalidatePath(`/vehicles/${vehicleId}/settings`);
  return {};
}

export async function updateShareRoleAction(
  vehicleId: string,
  targetUserId: string,
  role: string
): Promise<void> {
  await requireOwner(vehicleId);
  await db.vehicleShare.updateMany({
    where: { vehicleId, userId: targetUserId },
    data: { role: normalizeRole(role) },
  });
  revalidatePath(`/vehicles/${vehicleId}/settings`);
}

export async function unshareVehicleAction(
  vehicleId: string,
  targetUserId: string
): Promise<void> {
  await requireOwner(vehicleId);
  await db.vehicleShare.deleteMany({ where: { vehicleId, userId: targetUserId } });
  revalidatePath(`/vehicles/${vehicleId}/settings`);
}
