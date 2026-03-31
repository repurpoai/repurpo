import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { NextResponse } from "next/server";

function getOriginFromUrl(value: string | null) {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function applyPrivateNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  return applyPrivateNoStore(response);
}

export function normalizeCookieOptions(options?: Partial<ResponseCookie>): Partial<ResponseCookie> {
  return {
    path: "/",
    sameSite: options?.sameSite ?? "lax",
    secure: options?.secure ?? process.env.NODE_ENV === "production",
    ...options
  };
}

export function assertTrustedOrigin(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const originHeader = getOriginFromUrl(request.headers.get("origin"));
  const refererOrigin = getOriginFromUrl(request.headers.get("referer"));

  if (originHeader && originHeader !== requestOrigin) {
    return {
      ok: false,
      response: jsonNoStore({ error: "Cross-site request blocked." }, { status: 403 })
    } as const;
  }

  if (!originHeader && refererOrigin && refererOrigin !== requestOrigin) {
    return {
      ok: false,
      response: jsonNoStore({ error: "Cross-site request blocked." }, { status: 403 })
    } as const;
  }

  return { ok: true } as const;
}
