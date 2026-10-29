"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { createUserSchema, resetPasswordSchema } from "@/lib/validation";

export type ActionState = { error?: string; success?: string };

export async function createUserAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  const existing = await db.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return { error: "Diese E-Mail ist bereits vergeben." };

  const passwordHash = await hashPassword(parsed.data.password);
  await db.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      passwordHash,
    },
  });
  revalidatePath("/admin/users");
  return { success: `Benutzer ${parsed.data.email} angelegt.` };
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const parsed = resetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.user.update({
    where: { id: parsed.data.userId },
    data: { passwordHash },
  });
  // Invalidate that user's sessions for safety.
  await db.session.deleteMany({ where: { userId: parsed.data.userId } });
  revalidatePath("/admin/users");
  return { success: "Passwort zurückgesetzt." };
}

export async function toggleUserActiveAction(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.id) return; // don't lock yourself out
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;
  await db.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });
  if (user.isActive) {
    // was active -> now deactivated: kill sessions
    await db.session.deleteMany({ where: { userId } });
  }
  revalidatePath("/admin/users");
}

export async function deleteUserAction(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.id) return; // can't delete yourself
  await db.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
}
