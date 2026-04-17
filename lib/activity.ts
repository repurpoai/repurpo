import { createAdminClient } from "@/lib/supabase/admin";

export type ActivityLogInput = {
  actorUserId?: string | null;
  targetUserId?: string | null;
  action: string;
  metadata?: Record<string, unknown> | null;
};

export async function logActivity(input: ActivityLogInput) {
  try {
    const admin = createAdminClient();
    await admin.from("user_logs").insert({
      actor_user_id: input.actorUserId ?? null,
      target_user_id: input.targetUserId ?? null,
      action: input.action,
      metadata: input.metadata ?? {}
    });
  } catch {
    // Activity tracking should never block product flows.
  }
}
