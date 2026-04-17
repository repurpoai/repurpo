import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAdminDashboardData, requireAdmin } from "@/lib/admin";
import { updateMaintenanceAction, updateUserRoleAction, blockUserAction } from "@/app/admin/actions";

export default async function AdminPage() {
  const viewer = await requireAdmin();
  const data = await getAdminDashboardData();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="border-0 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-soft">
          <CardHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-slate-200">
              Admin panel
            </div>
            <CardTitle className="text-3xl text-white">Control center</CardTitle>
            <CardDescription className="text-slate-300">
              Manage users, roles, blocks, logs, and maintenance mode. Signed in as {viewer.email ?? viewer.userId}.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-0 bg-white shadow-soft">
            <CardHeader>
              <CardTitle>Maintenance mode</CardTitle>
              <CardDescription>Pause the app when you need to fix security or stability issues.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateMaintenanceAction} className="space-y-4">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" name="maintenance_mode" defaultChecked={data.settings.maintenance_mode} className="h-4 w-4 rounded border-slate-300" />
                  Enable maintenance mode
                </label>
                <Textarea
                  name="maintenance_message"
                  defaultValue={data.settings.maintenance_message ?? ""}
                  placeholder="Optional message for visitors"
                  className="min-h-28"
                />
                <Button type="submit">Save maintenance settings</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-0 bg-white shadow-soft">
            <CardHeader>
              <CardTitle>Stats</CardTitle>
              <CardDescription>Quick snapshot of the control panel.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Users</div>
                <div className="mt-1 text-2xl font-semibold">{data.profiles.length}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Blocked</div>
                <div className="mt-1 text-2xl font-semibold">{data.profiles.filter((p) => p.is_blocked).length}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Logs</div>
                <div className="mt-1 text-2xl font-semibold">{data.logs.length}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 bg-white shadow-soft">
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>Change roles, block users, or clear blocks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 overflow-x-auto">
            <div className="min-w-[900px] space-y-3">
              {data.profiles.map((user) => (
                <div key={user.id} className="grid grid-cols-[1.6fr_1fr_0.8fr_1fr_1.6fr] gap-3 rounded-2xl border border-slate-200 p-4 text-sm">
                  <div>
                    <div className="font-medium text-slate-950">{user.email ?? "—"}</div>
                    <div className="text-slate-500">{user.full_name ?? "No name"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Role</div>
                    <div className="font-medium capitalize">{user.role ?? "user"}</div>
                    <form action={updateUserRoleAction} className="mt-2 flex gap-2">
                      <input type="hidden" name="user_id" value={user.id} />
                      <select name="role" defaultValue={user.role ?? "user"} className="h-10 rounded-xl border border-slate-200 px-3">
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                      <Button type="submit" variant="secondary" size="sm">Save</Button>
                    </form>
                  </div>
                  <div>
                    <div className="text-slate-500">Plan</div>
                    <div className="font-medium capitalize">{user.tier ?? "free"}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Status</div>
                    <div className="font-medium">{user.is_blocked ? "Blocked" : "Active"}</div>
                    <div className="text-xs text-slate-500">{user.blocked_until ? `Until ${formatDateTime(user.blocked_until)}` : ""}</div>
                  </div>
                  <div className="space-y-2">
                    <form action={blockUserAction} className="space-y-2 rounded-2xl border border-slate-200 p-3">
                      <input type="hidden" name="user_id" value={user.id} />
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                        <input type="checkbox" name="blocked" defaultChecked={user.is_blocked ?? false} className="h-4 w-4 rounded border-slate-300" />
                        Block user
                      </label>
                      <Input name="reason" placeholder="Reason" defaultValue={user.block_reason ?? ""} />
                      <Input name="blocked_until" type="datetime-local" placeholder="Optional until" />
                      <Button type="submit" variant="secondary" size="sm" className="w-full">
                        Save block state
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white shadow-soft">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest admin and user events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.logs.length === 0 ? (
              <p className="text-sm text-slate-500">No activity logged yet.</p>
            ) : (
              data.logs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-200 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-slate-950">{log.action}</div>
                    <div className="text-slate-500">{formatDateTime(log.created_at)}</div>
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 ? (
                    <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{JSON.stringify(log.metadata, null, 2)}</pre>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
