import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {temporaryAuthCookie} from "./kakao-policy";
import { AppError } from "../domain/model";
export const authEnabled = () =>
  Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_PUBLISHABLE_KEY &&
      process.env.APP_ORIGIN,
  );
export function authClient(req: NextRequest, res: NextResponse) {
  if (!authEnabled())
    throw new AppError(
      "AUTH_NOT_CONFIGURED",
      503,
      "카카오 로그인 연결을 준비하고 있어요. 잠시 후 다시 확인해 주세요.",
    );
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        name: temporaryAuthCookie,
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(process.env.APP_ORIGIN!).protocol === "https:",
        path: "/",
      },
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (items) => {
          for (const c of items) {
            req.cookies.set(c.name, c.value);
            res.cookies.set(c.name, c.value, c.options);
          }
        },
      },
    },
  );
}
export function setSession(res: NextResponse, secret: string) {
  res.cookies.set("saju_session", secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(process.env.APP_ORIGIN!).protocol === "https:",
    path: "/",
    maxAge: 30 * 86400,
  });
}
