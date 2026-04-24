import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applyPrivateNoStore, normalizeCookieOptions } from "@/lib/http-security";
import { getAppSettings } from "@/lib/app-settings";
import { isBlockActive } from "@/lib/account-status";

type AppMetadata = {
  is_admin?: boolean;
  is_blocked?: boolean;
  role?: string;
  block_reason?: string | null;
  blocked_until?: string | null;
};

function readAppMetadata(source: unknown): AppMetadata {
  if (!source || typeof source !== "object") {
    return {};
  }

  const record = source as Record<string, unknown>;

  const claims = record.claims;
  if (claims && typeof claims === "object") {
    const claimsRecord = claims as Record<string, unknown>;
    return ((claimsRecord.app_metadata ?? claimsRecord.user_metadata ?? {}) as AppMetadata) ?? {};
  }

  const user = record.user;
  if (user && typeof user === "object") {
    const userRecord = user as Record<string, unknown>;
    return ((userRecord.app_metadata ?? userRecord.user_metadata ?? {}) as AppMetadata) ?? {};
  }

  return ((record.app_metadata ?? record.user_metadata ?? {}) as AppMetadata) ?? {};
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set({
      ...cookie,
      ...normalizeCookieOptions(cookie)
    });
  });

  if (from.cookies.getAll().length > 0) {
    applyPrivateNoStore(to);
  }

  return to;
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/check-email" ||
    pathname === "/blocked" ||
    pathname === "/maintenance" ||
    pathname === "/pricing" ||
    pathname === "/auth/confirm" ||
    pathname.startsWith("/privacy-policy") ||
    pathname.startsWith("/terms-of-service") ||
    pathname.startsWith("/refund-policy")
  );
}

function isApiAllowlisted(pathname: string) {
  return (
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/signup" ||
    pathname === "/api/auth/confirm" ||
    pathname === "/api/health" ||
    pathname === "/api/dodo/webhook"
  );
}

function isMaintenanceAllowed(pathname: string, isAdmin: boolean, allowAdmin: boolean) {
  if (allowAdmin && isAdmin) return true;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return false;
  }

  return isPublicPath(pathname) || isApiAllowlisted(pathname);
}

function redirectTo(request: NextRequest, pathname: string, searchParams?: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url);
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api/");
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, normalizeCookieOptions(options));
          });
        }
      }
    }
  );

  const [{ data: sessionData }, { data: claimsData }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getClaims()
  ]);

  const session = sessionData.session;
  const userId = session?.user?.id ?? claimsData?.claims?.sub ?? null;
  const isAuthenticated = Boolean(userId);

  const sessionMetadata = readAppMetadata(session?.user);
  const claimsMetadata = readAppMetadata(claimsData);
  const adminRouteMetadata = isAdminRoute ? readAppMetadata((await supabase.auth.getUser()).data.user) : {};
  const appMetadata: AppMetadata = {
    ...sessionMetadata,
    ...claimsMetadata,
    ...adminRouteMetadata
  };

  const isAdmin = appMetadata.is_admin === true || appMetadata.role === "admin";
  const isBlocked = isBlockActive(appMetadata.is_blocked, appMetadata.blocked_until);
  const blockReason = typeof appMetadata.block_reason === "string" ? appMetadata.block_reason : null;

  const appSettings = await getAppSettings();
  const maintenanceActive = Boolean(appSettings.maintenance_mode);
  const maintenanceMessage = appSettings.maintenance_message?.trim() || "We’re temporarily under maintenance.";

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/check-email") ||
    pathname.startsWith("/auth/confirm");

  const isBlockedRoute = pathname.startsWith("/blocked");
  const isMaintenanceRoute = pathname.startsWith("/maintenance");
  const isProtectedRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/history") || pathname.startsWith("/profile");
  const isSensitiveApiRoute =
    pathname.startsWith("/api/") && !isApiAllowlisted(pathname) && !pathname.startsWith("/api/auth/login");

  if (isBlocked && (isProtectedRoute || isAdminRoute || isSensitiveApiRoute) && !isBlockedRoute) {
    if (isApiRoute) {
      return jsonError(blockReason || "Your account is blocked.", 403);
    }

    return copyCookies(response, redirectTo(request, "/blocked", blockReason ? { reason: blockReason } : undefined));
  }

  if (isAdminRoute && !isAuthenticated) {
    if (isApiRoute) {
      return jsonError("Please log in first.", 401);
    }

    return copyCookies(response, redirectTo(request, "/login", { next: pathname }));
  }

  if (isAuthenticated && isAdminRoute && !isAdmin) {
    if (isApiRoute) {
      return jsonError("Unauthorized.", 403);
    }

    return copyCookies(response, redirectTo(request, "/dashboard"));
  }

  if (maintenanceActive && !isMaintenanceAllowed(pathname, isAdmin, appSettings.allow_admin !== false)) {
    if (isApiRoute && !isApiAllowlisted(pathname)) {
      return jsonError(maintenanceMessage, 503);
    }

    if (!isMaintenanceRoute) {
      return copyCookies(response, redirectTo(request, "/maintenance"));
    }
  }

  if (!isAuthenticated && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return copyCookies(response, applyPrivateNoStore(NextResponse.redirect(url)));
  }

  if (isAuthenticated && isAuthRoute && !isBlocked) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return copyCookies(response, applyPrivateNoStore(NextResponse.redirect(url)));
  }

  if (response.cookies.getAll().length > 0) {
    applyPrivateNoStore(response);
  }

  return response;
}
