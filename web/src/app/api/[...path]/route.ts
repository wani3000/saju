import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { readRequestBody } from "@/server/request-body";
import { database,one } from "@/server/db";
import { AppError } from "@/domain/model";
import * as service from "@/server/service";
import { authClient, authEnabled } from "@/server/auth";
import { startIdentity, finishIdentity } from "@/server/identity";
import { prepareNicepay } from "@/server/nicepay-checkout";
import { erasePersonalData } from "@/server/operations";
import * as payment from "@/server/payments";
import {kakaoRequired,hasKakaoSession,requireKakaoSession,loggedOutState} from '@/server/kakao-policy';
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cookieName = "saju_session";
function sessionCookie(res: NextResponse, secret: string, req: NextRequest) {
  res.cookies.set(cookieName, secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(process.env.APP_ORIGIN ?? req.nextUrl.origin).protocol === "https:",
    path: "/",
    maxAge: 30 * 86400,
  });
  return res;
}
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
export async function DELETE(req: NextRequest) {
  return handle(req);
}
async function handle(req: NextRequest) {
  const requestId = randomUUID();
  const send = (data: unknown, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Request-Id": requestId,
      },
    });
  try {
    const path = req.nextUrl.pathname.slice(5);
    const db = await database();
    if (req.method !== "GET") {
      const expected =
        process.env.APP_ORIGIN ??
        `${req.nextUrl.protocol}//${req.headers.get("host")}`;
      if (req.headers.get("origin") !== expected)
        throw new AppError(
          "ORIGIN_REJECTED",
          403,
          "원래 앱 화면에서 다시 시도해 주세요.",
        );
    }
    // This development app is closed to public deployment until auth/content/PG review is complete.
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(req.nextUrl.hostname) &&
      process.env.ALLOW_REMOTE_TEST !== "true"
    )
      throw new AppError("LOCAL_ONLY", 503, "현재 로컬 개발용 서비스예요.");
    if(!["localhost","127.0.0.1","[::1]"].includes(req.nextUrl.hostname) && !kakaoRequired())
      throw new AppError("UNSAFE_AUTH_MODE",503,"카카오 로그인 설정을 확인해 주세요.");
    let body: Record<string, any> = {};
    if (req.method === "POST") {
      const raw = await readRequestBody(req);
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        throw new AppError("INVALID_JSON");
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new AppError("INVALID_JSON");
    }
    let owner = await service.sessionOwner(
      db,
      req.cookies.get(cookieName)?.value,
    );
    if (path === "session" && req.method === "POST") {
      if (owner) return send({ ok: true });
      await service.rateLimit(db, "session-create", 60);
      const session = await service.newSession(db);
      return sessionCookie(send({ ok: true }), session.secret, req);
    }
    if (path === "recover" && req.method === "POST") {
      if(kakaoRequired())throw new AppError('KAKAO_LOGIN_REQUIRED',401,'카카오로 로그인한 뒤 시작해 주세요.');
      await service.rateLimit(db, "recovery-attempt", 20);
      const session = await service.recover(db, String(body.code ?? ""));
      return sessionCookie(send({ ok: true }), session.secret, req);
    }
    if (!owner)
      throw new AppError(
        "UNAUTHORIZED",
        401,
        "세션이 만료됐어요. 다시 시작하거나 복구 코드를 입력해 주세요.",
      );
    await service.rateLimit(db, owner);
    if (path === "state" && req.method === "GET") {
      const authenticated=await hasKakaoSession(db,owner,service.hash(req.cookies.get(cookieName)!.value));
      return send({
        ...(kakaoRequired()&&!authenticated?loggedOutState():await service.state(db, owner)),
        authRequired:kakaoRequired(),authenticated,
        authEnabled: authEnabled(),
        provider: process.env.PAYMENT_PROVIDER ?? "mock",
        tossClientKey: process.env.TOSS_CLIENT_KEY?.startsWith("test_ck_")
          ? process.env.TOSS_CLIENT_KEY
          : null,
      });
    }
    if (path === "auth/start" && req.method === "POST") {
      const res = send({});
      const auth = authClient(req, res);
      const attempt = await startIdentity(db, owner);
      const { data, error } = await auth.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: process.env.APP_ORIGIN + "/auth/callback",
          skipBrowserRedirect: true,
        },
      });
      if (error || !data.url) throw new AppError("AUTH_UNAVAILABLE", 503);
      res.cookies.set("saju_auth", attempt, {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(process.env.APP_ORIGIN!).protocol === "https:",
        path: "/",
        maxAge: 600,
      });
      const response = send({ url: data.url });
      for (const c of res.cookies.getAll()) response.cookies.set(c);
      return response;
    }
    if (path === "auth/finish" && req.method === "POST") {
      if (body.choice !== "merge" && body.choice !== "switch")
        throw new AppError("INVALID_CHOICE");
      const target = await finishIdentity(
        db,
        owner,
        req.cookies.get("saju_merge")?.value ?? "",
        body.choice === "merge",
      );
      const identity=await one(db,'SELECT subject FROM auth_identities WHERE owner_id=$1',[target]);
      if(!identity)throw new AppError('INVALID_IDENTITY',401);
      const session = await service.newSession(db, target,identity.subject);
      const res = sessionCookie(send({ ok: true }), session.secret, req);
      res.cookies.delete("saju_merge");
      return res;
    }
    if(kakaoRequired()){
      await requireKakaoSession(db,owner,service.hash(req.cookies.get(cookieName)!.value));
      if(path==='recovery-code')throw new AppError('RECOVERY_UNAVAILABLE',403,'카카오 로그인으로 기록을 다시 열 수 있어요.');
    }
    if (path === "draft" && req.method === "POST")
      return send(await service.saveDraft(db, owner, body.pair, body.revision));
    if (path === "recovery-code" && req.method === "POST")
      return send({ code: await service.recoveryCode(db, owner) });
    if (path === "account" && req.method === "DELETE") {
      await erasePersonalData(db, owner);
      const res = send({ ok: true });
      res.cookies.delete(cookieName);
      return res;
    }
    if (path === "logout" && req.method === "POST") {
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [
        service.hash(req.cookies.get(cookieName)!.value),
      ]);
      const res = send({ ok: true });
      res.cookies.delete(cookieName);
      return res;
    }
    if (path === "comparisons" && req.method === "POST")
      return send(
        await service.createComparison(
          db,
          owner,
          body.pair,
          String(body.key ?? ""),
          body.consent,
          process.env.PAYMENT_PROVIDER ?? "mock",
        ),
      );
    if (path === "process" && req.method === "POST") {
      await service.runJobs(db, owner);
      return send({ ok: true });
    }
    const parts = path.split("/");
    const id = parts[1];
    if (id && !z.uuid().safeParse(id).success)
      throw new AppError("NOT_FOUND", 404);
    if (parts[0] === "results" && parts.length === 2 && req.method === "GET")
      return send(await service.result(db, owner, id));
    if (
      parts[0] === "results" &&
      parts.length === 3 &&
      parts[2] === "shares" &&
      req.method === "POST"
    )
      return send(await service.share(db, owner, id, body.aliases));
    if (parts[0] === "shares" && parts.length === 2 && req.method === "DELETE") {
      await service.revokeShare(db, owner, id);
      return send({ ok: true });
    }
    if (
      parts[0] === "comparisons" &&
      parts.length === 3 &&
      parts[2] === "retry" &&
      req.method === "POST"
    ) {
      await service.retryJob(db, owner, id);
      return send({ ok: true });
    }
    if (parts[0] === "orders" && parts.length === 3 && req.method === "POST") {
      // Authorize every order action before reading provider settings or preparing checkout.
      const order = await payment.ownedOrder(db, owner, id);
      if (parts[2] === "prepare")
        return send(
          await prepareNicepay(
            db,
            owner,
            id,
            process.env.APP_ORIGIN ?? req.nextUrl.origin,
          ),
        );
      if (
        parts[2] === "confirm" &&
        order.provider === "nicepay-test"
      )
        throw new AppError("SIGNED_RETURN_REQUIRED", 403);
      if (parts[2] === "confirm")
        await payment.confirmPayment(
          db,
          owner,
          id,
          body.paymentKey,
          body.amount,
        );
      else if (parts[2] === "reconcile")
        await payment.reconcilePayment(db, owner, id);
      else if (parts[2] === "refund")
        await payment.refundPayment(db, owner, id);
      else if (parts[2] === "cancel") await payment.cancelOrder(db, owner, id);
      else throw new AppError("NOT_FOUND", 404);
      return send({ ok: true });
    }
    throw new AppError("NOT_FOUND", 404);
  } catch (e) {
    const error =
      e instanceof AppError
        ? e
        : new AppError(
            "INTERNAL",
            503,
            "잠시 후 다시 시도해 주세요. 입력과 주문은 저장되어 있어요.",
          );
    // Deliberately do not log request URLs, bodies, birth data, share tokens or payment keys.
    if (!(e instanceof AppError))
      console.error("saju-request-failed", requestId);
    return send(
      {
        code: error.code,
        message: error.message,
        requestId,
        retryable: error.status >= 500,
      },
      error.status,
    );
  }
}
