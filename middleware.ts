import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // First keep your existing session handling
  const response = await updateSession(request);

  const supabase = createMiddlewareClient({
    req: request,
    res: response,
  });

  // Get user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let isBlocked = false;
  let maintenanceMode = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_blocked")
      .eq("id", user.id)
      .single();

    isAdmin = profile?.role === "admin";
    isBlocked = profile?.is_blocked ?? false;
  }

  // Get app settings
  const { data: settings } = await supabase
    .from("app_settings")
    .select("maintenance_mode")
    .eq("id", 1)
    .single();

  maintenanceMode = settings?.maintenance_mode ?? false;

  const pathname = request.nextUrl.pathname;

  // 🚫 BLOCKED USER
  if (isBlocked && pathname !== "/blocked") {
    return NextResponse.redirect(new URL("/blocked", request.url));
  }

  // 🔧 MAINTENANCE MODE
  if (
    maintenanceMode &&
    !isAdmin &&
    pathname !== "/maintenance" &&
    !pathname.startsWith("/admin")
  ) {
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};