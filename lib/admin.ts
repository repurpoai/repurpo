import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewerContext, type ViewerContext } from "@/lib/viewer";

export type AdminProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  tier: string | null;
  is_blocked: boolean | null;
  block_reason: string | null;
  blocked_until: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminLogRow = {
  id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function requireAdmin(): Promise<ViewerContext> {
  const viewer = await getViewerContext();

  if (!viewer) {
    redirect("/login");
  }

  if (viewer.role !== "admin") {
    redirect("/dashboard");
  }

  return viewer;
}

const USER_PAGE_SIZE = 8;
const LOG_PAGE_SIZE = 8;

function normalizePage(value: number | undefined, fallback = 1) {
  const page = Number.isFinite(value ?? NaN) ? Math.floor(value ?? 0) : fallback;
  return Math.max(page || fallback, 1);
}

function sanitizeSearch(query: string) {
  return query.trim().replace(/[%(),]/g, " ").replace(/\s+/g, " ").trim();
}

export async function getAdminDashboardData(options?: {
  userPage?: number;
  logPage?: number;
  query?: string;
  userId?: string | null;
}) {
  const admin = createAdminClient();
  const userPage = normalizePage(options?.userPage);
  const logPage = normalizePage(options?.logPage);
  const query = options?.query?.trim() ?? "";
  const selectedUserId = options?.userId?.trim() || null;
  const userOffset = (userPage - 1) * USER_PAGE_SIZE;
  const logOffset = (logPage - 1) * LOG_PAGE_SIZE;
  const safeSearch = sanitizeSearch(query);

  let profileQuery = admin
    .from("profiles")
    .select("id, email, full_name, role, tier, is_blocked, block_reason, blocked_until, created_at, updated_at");

  if (safeSearch) {
    profileQuery = profileQuery.or(`email.ilike.%${safeSearch}%,full_name.ilike.%${safeSearch}%`);
  }

  let logQuery = admin
    .from("user_logs")
    .select("id, actor_user_id, target_user_id, action, metadata, created_at");

  if (selectedUserId) {
    logQuery = logQuery.or(`actor_user_id.eq.${selectedUserId},target_user_id.eq.${selectedUserId}`);
  }

  const [{ data: profilesRaw }, { data: logsRaw }, { data: settings }, { count: totalUsersResult }] = await Promise.all([
    profileQuery.order("created_at", { ascending: false }).range(userOffset, userOffset + USER_PAGE_SIZE),
    logQuery.order("created_at", { ascending: false }).range(logOffset, logOffset + LOG_PAGE_SIZE),
    admin
      .from("app_settings")
      .select("maintenance_mode, maintenance_message, allow_admin")
      .eq("id", 1)
      .maybeSingle(),
    admin.from("profiles").select("id", { count: "planned", head: true })
  ]);

  const profiles = (profilesRaw ?? []) as AdminProfileRow[];
  const logs = (logsRaw ?? []) as AdminLogRow[];

  return {
    profiles: profiles.slice(0, USER_PAGE_SIZE),
    logs: logs.slice(0, LOG_PAGE_SIZE),
    totalUsers: totalUsersResult ?? profiles.length,
    userPage,
    logPage,
    hasMoreUsers: profiles.length > USER_PAGE_SIZE,
    hasMoreLogs: logs.length > LOG_PAGE_SIZE,
    selectedUserId,
    settings: {
      maintenance_mode: Boolean(settings?.maintenance_mode),
      maintenance_message: typeof settings?.maintenance_message === "string" ? settings.maintenance_message : null,
      allow_admin: settings?.allow_admin !== false
    }
  };
}
