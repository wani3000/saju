import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
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
      "로그인 연결 준비 중이에요. 복구 코드로 보관할 수 있어요.",
    );
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
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
