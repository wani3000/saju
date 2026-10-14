import { NextRequest, NextResponse } from "next/server";
import { database } from "@/server/db";
import { sessionOwner, newSession, hash, rateLimit } from "@/server/service";
import { bindIdentity } from "@/server/identity";
import { authClient, setSession } from "@/server/auth";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const origin = process.env.APP_ORIGIN;
  if (!origin) return new Response("Unavailable", { status: 503 });
  const res = NextResponse.redirect(new URL("/?auth=complete", origin));
  res.headers.set("Cache-Control", "no-store");
  let auth: ReturnType<typeof authClient> | undefined;
  try {
    const db = await database();
    await rateLimit(db, "oauth-callback", 30);
    const old = req.cookies.get("saju_session")?.value;
    const owner = await sessionOwner(db, old),
      attempt = req.cookies.get("saju_auth")?.value,
      code = req.nextUrl.searchParams.get("code");
    if (!owner || !attempt || !code || code.length > 2048)
      throw new Error("INVALID_AUTH");
    auth = authClient(req, res);
    const exchange = await auth.auth.exchangeCodeForSession(code);
    if (exchange.error) throw exchange.error;
    const { data, error } = await auth.auth.getUser();
    if (error || !data.user || data.user.is_anonymous)
      throw new Error("INVALID_AUTH");
    const linked = await bindIdentity(db, owner, attempt, data.user.id);
    // Keep only the local server session; remove temporary Supabase session cookies.
    if (linked.ticket) {
      res.cookies.set("saju_merge", linked.ticket, {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(origin).protocol === "https:",
        path: "/",
        maxAge: 600,
      });
      res.headers.set("Location", new URL("/?auth=review", origin).toString());
    } else {
      const session = await newSession(db, linked.owner);
      setSession(res, session.secret);
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [hash(old!)]);
    }
  } catch {
    res.headers.set("Location", new URL("/?auth=failed", origin).toString());
  } finally {
    if (auth) await auth.auth.signOut({ scope: "local" }).catch(() => {});
  }
  res.cookies.delete("saju_auth");
  return res;
}
