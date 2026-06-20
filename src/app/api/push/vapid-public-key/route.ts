import { getCurrentUser } from "@/lib/auth/session";
import { getVapidPublicKey } from "@/lib/push";

// The public VAPID key the browser needs to subscribe. Resolved at runtime
// (the keypair lives in the DB), so it can't be inlined at build time.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const key = await getVapidPublicKey();
  return Response.json({ key });
}
