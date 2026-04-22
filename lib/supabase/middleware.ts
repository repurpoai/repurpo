import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applyPrivateNoStore, normalizeCookieOptions } from "@/lib/http-security";
import { getAppSettings } from "@/lib/app-settings";
import { isBlockActive } from "@/lib/account-status";

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

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  const isAuthenticated = Boolean(userId);

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

  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const isBlockedRoute = pathname.startsWith("/blocked");
  const isMaintenanceRoute = pathname.startsWith("/maintenance");
  const isProtectedRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/history") || pathname.startsWith("/profile");
  const isSensitiveApiRoute =
    pathname.startsWith("/api/") && !isApiAllowlisted(pathname) && !pathname.startsWith("/api/auth/login");

  let isAdmin = false;
  let isBlocked = false;
  let blockReason: string | null = null;

  const needsProfile =
    isAuthenticated &&
    (maintenanceActive || isAdminRoute || isProtectedRoute || isSensitiveApiRoute || isAuthRoute);

  if (needsProfile) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_blocked, block_reason, blocked_until")
      .eq("id", userId)
      .maybeSingle();

    isAdmin = profile?.role === "admin";
    isBlocked = isBlockActive(profile?.is_blocked, profile?.blocked_until);
    blockReason = typeof profile?.block_reason === "string" ? profile.block_reason : null;
  }

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
