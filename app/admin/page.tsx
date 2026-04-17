import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAdminDashboardData, requireAdmin } from "@/lib/admin";
import { updateMaintenanceAction, updateUserRoleAction, blockUserAction } from "@/app/admin/actions";
import { PageShell } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";
import { FlashBanner } from "@/components/flash-banner";

const flashMessages: Record<string, { title: string; message: string; tone: "success" | "error" | "info" }> = {
  maintenance_saved: {
    title: "Saved",
    message: "Maintenance settings updated successfully.",
    tone: "success"
  },
  role_updated: {
    title: "Saved",
    message: "User role updated successfully.",
    tone: "success"
  },
  role_updated_email_failed: {
    title: "Saved",
    message: "User role updated, but the email could not be sent.",
    tone: "error"
  },
  user_blocked_email_sent: {
    title: "Saved",
    message: "User was blocked and the email was sent.",
    tone: "success"
  },
  user_blocked_email_failed: {
    title: "Saved",
    message: "User was blocked, but the email could not be sent.",
    tone: "error"
  },
  user_unblocked_email_sent: {
    title: "Saved",
    message: "User was unblocked and the email was sent.",
    tone: "success"
  },
  user_unblocked_email_failed: {
    title: "Saved",
    message: "User was unblocked, but the email could not be sent.",
    tone: "error"
  }
};

export default async function AdminPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireAdmin();
  const data = await getAdminDashboardData();
  const params = (await searchParams) ?? {};
  const flash = typeof params.flash === "string" ? params.flash : null;
  const detail = typeof params.detail === "string" ? params.detail : null;
  const flashInfo = flash ? flashMessages[flash] : null;
  const flashMessage = flashInfo ? (detail ? `${flashInfo.message} ${detail}` : flashInfo.message) : null;

  return (
    <PageShell>
      {flashInfo ? <FlashBanner title={flashInfo.title} message={flashMessage} tone={flashInfo.tone} /> : null}
      <SiteHeader links={[{ href: "/dashboard", label: "Dashboard" }, { href: "/", label: "Home" }, { href: "/pricing", label: "Pricing" }]} />

      <div className="space-y-6 py-6">
        <Card className="border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
          <CardHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200">
              Admin panel
            </div>
            <CardTitle className="text-3xl text-white">Control center</CardTitle>
            <CardDescription className="text-slate-300">
              Manage users, roles, blocks, logs, and maintenance mode. Signed in as {viewer.email ?? viewer.userId}.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Maintenance mode</CardTitle>
              <CardDescription className="text-slate-300">Pause the app when you need to fix security or stability issues.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateMaintenanceAction} className="space-y-4">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-200">
                  <input type="checkbox" name="maintenance_mode" defaultChecked={data.settings.maintenance_mode} className="h-4 w-4 rounded border-slate-300" />
                  Enable maintenance mode
                </label>
                <Textarea
                  name="maintenance_message"
                  defaultValue={data.settings.maintenance_message ?? ""}
                  placeholder="Optional message for visitors"
                  className="min-h-28 border-white/10 bg-slate-950/70 text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:ring-emerald-500/20"
                />
                <Button type="submit" className="bg-emerald-400 text-slate-950 hover:bg-emerald-300">
                  Save maintenance settings
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Stats</CardTitle>
              <CardDescription className="text-slate-300">Quick snapshot of the control panel.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="text-sm text-slate-400">Users</div>
                <div className="mt-1 text-2xl font-semibold text-white">{data.profiles.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="text-sm text-slate-400">Blocked</div>
                <div className="mt-1 text-2xl font-semibold text-white">{data.profiles.filter((p) => p.is_blocked).length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="text-sm text-slate-400">Logs</div>
                <div className="mt-1 text-2xl font-semibold text-white">{data.logs.length}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Users</CardTitle>
            <CardDescription className="text-slate-300">Change roles, block users, or clear blocks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 overflow-x-auto">
            <div className="min-w-[900px] space-y-3">
              {data.profiles.map((user) => (
                <div key={user.id} className="grid grid-cols-[1.6fr_1fr_0.8fr_1fr_1.6fr] gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm">
                  <div>
                    <div className="font-medium text-white">{user.email ?? "—"}</div>
                    <div className="text-slate-400">{user.full_name ?? "No name"}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Role</div>
                    <div className="font-medium capitalize text-white">{user.role ?? "user"}</div>
                    <form action={updateUserRoleAction} className="mt-2 flex gap-2">
                      <input type="hidden" name="user_id" value={user.id} />
                      <select name="role" defaultValue={user.role ?? "user"} className="h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100">
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                      <Button type="submit" variant="secondary" size="sm" className="border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
                        Save
                      </Button>
                    </form>
                  </div>
                  <div>
                    <div className="text-slate-400">Plan</div>
                    <div className="font-medium capitalize text-white">{user.tier ?? "free"}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Status</div>
                    <div className="font-medium text-white">{user.is_blocked ? "Blocked" : "Active"}</div>
                    <div className="text-xs text-slate-400">{user.blocked_until ? `Until ${formatDateTime(user.blocked_until)}` : ""}</div>
                  </div>
                  <div className="space-y-2">
                    <form action={blockUserAction} className="space-y-2 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
                      <input type="hidden" name="user_id" value={user.id} />
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-200">
                        <input type="checkbox" name="blocked" defaultChecked={user.is_blocked ?? false} className="h-4 w-4 rounded border-slate-300" />
                        Block user
                      </label>
                      <Input
                        name="reason"
                        placeholder="Reason"
                        defaultValue={user.block_reason ?? ""}
                        className="border-white/10 bg-slate-950/70 text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:ring-emerald-500/20"
                      />
                      <Input
                        name="blocked_until"
                        type="datetime-local"
                        placeholder="Optional until"
                        className="border-white/10 bg-slate-950/70 text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:ring-emerald-500/20"
                      />
                      <Button type="submit" variant="secondary" size="sm" className="w-full border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
                        Save block state
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Recent activity</CardTitle>
            <CardDescription className="text-slate-300">Latest admin and user events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.logs.length === 0 ? (
              <p className="text-sm text-slate-400">No activity logged yet.</p>
            ) : (
              data.logs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-white">{log.action}</div>
                    <div className="text-slate-400">{formatDateTime(log.created_at)}</div>
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 ? (
                    <pre className="mt-2 overflow-x-auto rounded-xl bg-black/30 p-3 text-xs text-slate-300">{JSON.stringify(log.metadata, null, 2)}</pre>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
