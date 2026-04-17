import { createAdminClient } from "@/lib/supabase/admin";

export type AppSettings = {
  maintenance_mode: boolean;
  maintenance_message: string | null;
  allow_admin: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  maintenance_mode: false,
  maintenance_message: null,
  allow_admin: true
};

let cachedSettings: AppSettings | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 15_000;

export async function getAppSettings(): Promise<AppSettings> {
  if (cachedSettings && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedSettings;
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("app_settings")
      .select("maintenance_mode, maintenance_message, allow_admin")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_SETTINGS;
    }

    cachedSettings = {
      maintenance_mode: Boolean(data.maintenance_mode),
      maintenance_message: typeof data.maintenance_message === "string" ? data.maintenance_message : null,
      allow_admin: data.allow_admin !== false
    };
    cachedAt = Date.now();
    return cachedSettings;
  } catch {
    cachedSettings = DEFAULT_SETTINGS;
    cachedAt = Date.now();
    return DEFAULT_SETTINGS;
  }
}

export function clearAppSettingsCache() {
  cachedSettings = null;
  cachedAt = 0;
}
