import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createHmac, randomBytes } from "node:crypto";
import type { Role, User } from "@prisma/client";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "carlog_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_REFRESH_MS = 1000 * 60 * 60 * 24 * 15; // refresh when < 15 days left

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

// Only a keyed hash of the token is stored, so a database disclosure never
// yields usable session cookies. SESSION_SECRET acts as a server-side pepper:
// without it, the stored ids can't be reproduced even with DB + token guesses.
function hashToken(token: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const sessionId = hashToken(token);
  await db.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

async function validateToken(
  token: string
): Promise<SessionUser | null> {
  const sessionId = hashToken(token);
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  if (!session.user.isActive) {
    await db.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  // Sliding expiration
  if (session.expiresAt.getTime() - Date.now() < SESSION_REFRESH_MS) {
    await db.session.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
  }

  const u: User = session.user;
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}

/** Validate the current request's session. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateToken(token);
});

export async function invalidateSession(token: string): Promise<void> {
  await db.session.delete({ where: { id: hashToken(token) } }).catch(() => {});
}

function cookieSecure(): boolean {
  return process.env.COOKIE_SECURE === "true";
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
