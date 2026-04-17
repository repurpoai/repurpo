"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/activity";
import { sendTransactionalEmail } from "@/lib/brevo";
import { clearAppSettingsCache } from "@/lib/app-settings";

const roleSchema = z.enum(["user", "admin"]);

function parseOptionalDatetime(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function updateMaintenanceAction(formData: FormData) {
  const adminViewer = await requireAdmin();
  const enabled = formData.get("maintenance_mode") === "on";
  const maintenanceMessageValue = formData.get("maintenance_message");
  const message = typeof maintenanceMessageValue === "string" ? maintenanceMessageValue.trim() : "";

  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      id: 1,
      maintenance_mode: enabled,
      maintenance_message: message || null,
      allow_admin: true
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(error.message);
  }

  clearAppSettingsCache();

  await logActivity({
    actorUserId: adminViewer.userId,
    action: enabled ? "maintenance_enabled" : "maintenance_disabled",
    metadata: { message: message || null }
  });

  revalidatePath("/admin");
}

export async function updateUserRoleAction(formData: FormData) {
  const adminViewer = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "").trim();
  const roleResult = roleSchema.safeParse(formData.get("role"));

  if (!userId || !roleResult.success) {
    throw new Error("Invalid role update.");
  }

  const supabase = createAdminClient();
  const { data: currentUser, error: fetchError } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError || !currentUser) {
    throw new Error("User not found.");
  }

  const { error } = await supabase.from("profiles").update({ role: roleResult.data }).eq("id", userId);
  if (error) {
    throw new Error(error.message);
  }

  await logActivity({
    actorUserId: adminViewer.userId,
    targetUserId: userId,
    action: "role_updated",
    metadata: { role: roleResult.data }
  });

  await sendTransactionalEmail({
    to: { email: currentUser.email ?? "", name: currentUser.full_name },
    subject: `Your Repurpo role was updated to ${roleResult.data}`,
    html: `<p>Hello${currentUser.full_name ? ` ${currentUser.full_name}` : ""},</p><p>Your account role was updated to <strong>${roleResult.data}</strong>.</p>`,
    text: `Your Repurpo role was updated to ${roleResult.data}.`
  });

  revalidatePath("/admin");
}

export async function blockUserAction(formData: FormData) {
  const adminViewer = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const blockedUntil = parseOptionalDatetime(formData.get("blocked_until"));
  const blocked = formData.get("blocked") === "on";

  if (!userId) {
    throw new Error("User is required.");
  }

  const supabase = createAdminClient();
  const { data: currentUser, error: fetchError } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError || !currentUser) {
    throw new Error("User not found.");
  }

  const updatePayload = blocked
    ? {
        is_blocked: true,
        block_reason: reason || null,
        blocked_until: blockedUntil
      }
    : {
        is_blocked: false,
        block_reason: null,
        blocked_until: null
      };

  const { error } = await supabase.from("profiles").update(updatePayload).eq("id", userId);
  if (error) {
    throw new Error(error.message);
  }

  await logActivity({
    actorUserId: adminViewer.userId,
    targetUserId: userId,
    action: blocked ? "user_blocked" : "user_unblocked",
    metadata: { reason: reason || null, blockedUntil }
  });

  await sendTransactionalEmail({
    to: { email: currentUser.email ?? "", name: currentUser.full_name },
    subject: blocked ? "Your Repurpo account was paused" : "Your Repurpo account is active again",
    html: blocked
      ? `<p>Hello${currentUser.full_name ? ` ${currentUser.full_name}` : ""},</p><p>Your account was paused${reason ? ` for: <strong>${reason}</strong>` : ""}${blockedUntil ? ` until <strong>${new Date(blockedUntil).toLocaleString()}</strong>` : ""}.</p>`
      : `<p>Hello${currentUser.full_name ? ` ${currentUser.full_name}` : ""},</p><p>Your account has been unblocked.</p>`,
    text: blocked
      ? `Your Repurpo account was paused.${reason ? ` Reason: ${reason}.` : ""}${blockedUntil ? ` Until: ${new Date(blockedUntil).toLocaleString()}.` : ""}`
      : "Your Repurpo account has been unblocked."
  });

  revalidatePath("/admin");
}
