"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  invalidateSession,
  getCurrentUser,
  SESSION_COOKIE,
} from "@/lib/auth/session";
import {
  loginRetryAfterMs,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/auth/rate-limit";
import { loginSchema, changePasswordSchema } from "@/lib/validation";

export type ActionState = { error?: string; success?: string };

/**
 * Throttle key for failed logins: the client IP when a proxy provides it,
 * otherwise the submitted email (so a single account can't be brute-forced and
 * a missing IP can't lump everyone into one shared, easily-tripped bucket).
 */
async function loginThrottleKey(email: string): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
  return ip ? `ip:${ip}` : `email:${email.toLowerCase()}`;
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Bitte E-Mail und Passwort eingeben." };
  }

  const { email, password } = parsed.data;
  const key = await loginThrottleKey(email);

  const waitMs = loginRetryAfterMs(key);
  if (waitMs > 0) {
    const mins = Math.ceil(waitMs / 60000);
    return { error: `Zu viele Fehlversuche. Bitte in ${mins} Minute(n) erneut versuchen.` };
  }

  const user = await db.user.findUnique({ where: { email } });

  // Generic error to avoid user enumeration.
  const invalid: ActionState = { error: "E-Mail oder Passwort ist falsch." };
  if (!user || !user.isActive) {
    // Still spend time hashing to reduce timing signal.
    await hashPassword(password).catch(() => {});
    recordLoginFailure(key);
    return invalid;
  }

  const ok = await verifyPassword(user.passwordHash, password).catch(() => false);
  if (!ok) {
    recordLoginFailure(key);
    return invalid;
  }

  recordLoginSuccess(key);
  const token = await createSession(user.id);
  await setSessionCookie(token);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await invalidateSession(token);
  await clearSessionCookie();
  redirect("/login");
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Ungültige Eingabe." };
  }

  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser) redirect("/login");

  const ok = await verifyPassword(
    dbUser.passwordHash,
    parsed.data.currentPassword
  ).catch(() => false);
  if (!ok) return { error: "Aktuelles Passwort ist falsch." };

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  return { success: "Passwort wurde aktualisiert." };
}
