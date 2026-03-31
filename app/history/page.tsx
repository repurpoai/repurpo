import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, History as HistoryIcon } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TONE_META, type ContentTone, type LengthPreset } from "@/lib/plans";
import { formatDateTime, getSourceLabel } from "@/lib/utils";
import { getViewerContext } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";

type HistoryListRecord = {
  id: string;
  input_mode: "link" | "text" | "youtube";
  tone: ContentTone;
  length_preset: LengthPreset;
  source_url: string | null;
  source_title: string | null;
  created_at: string;
};

export default async function HistoryPage() {
  const viewer = await getViewerContext();

  if (!viewer) {
    redirect("/login");
  }

  const upgradeHref = "/pricing";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generations")
    .select("id, input_mode, tone, length_preset, source_url, source_title, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const records = (data ?? []) as HistoryListRecord[];

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 lg:flex-row lg:p-6">
        <Sidebar
          userName={viewer.userName}
          userEmail={viewer.email}
          tier={viewer.tier}
          usedThisMonth={viewer.usedThisMonth}
          monthlyLimit={viewer.monthlyLimit}
          remainingThisMonth={viewer.remainingThisMonth}
          imageUsedThisMonth={viewer.imageUsedThisMonth}
          imageMonthlyLimit={viewer.imageMonthlyLimit}
          imageRemainingThisMonth={viewer.imageRemainingThisMonth}
          usageWindowLabel={viewer.usageWindowLabel}
        />

        <section className="min-w-0 flex-1 space-y-6">
          <Card className="border-0 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-soft">
            <CardHeader>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-slate-200">
                <HistoryIcon className="h-4 w-4" />
                My history
              </div>
              <CardTitle className="text-3xl text-white">Your saved generations</CardTitle>
              <CardDescription className="text-slate-300">
                Tap any card to open the full generation.
              </CardDescription>
            </CardHeader>
          </Card>

          {!viewer.isPaid ? (
            <Card className="border-0 bg-white shadow-soft">
              <CardContent className="flex flex-col gap-3 py-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    Export and image workflows are reserved for paid plans.
                  </p>
                  <p className="text-sm text-slate-500">
                    Upgrade to Plus or Pro to unlock image generation and export tools.
                  </p>
                </div>
                <a
                  href={upgradeHref}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Upgrade
                </a>
              </CardContent>
            </Card>
          ) : null}

          {records.length === 0 ? (
            <Card className="border-0 bg-white shadow-soft">
              <CardContent className="py-10">
                <div className="space-y-2 text-center">
                  <p className="text-lg font-semibold text-slate-900">No saved generations yet</p>
                  <p className="text-slate-500">
                    Create your first repurposing run from the dashboard.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {records.map((record) => {
                const sourceLabel = getSourceLabel(record.source_title, record.source_url);

                return (
                  <Link key={record.id} href={`/history/${record.id}`} className="block">
                    <Card className="border-0 bg-white shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                      <CardHeader className="gap-5">
                        <CardTitle className="text-2xl leading-tight text-slate-950 sm:text-3xl">
                          {sourceLabel}
                        </CardTitle>

                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                          <span className="rounded-full bg-slate-100 px-5 py-2 capitalize">
                            {record.input_mode}
                          </span>
                          <span className="rounded-full bg-slate-100 px-5 py-2">
                            {TONE_META[record.tone]?.label ?? record.tone}
                          </span>
                          <span className="rounded-full bg-slate-100 px-5 py-2 capitalize">
                            {record.length_preset}
                          </span>
                        </div>

                        <p className="text-2xl text-slate-400 sm:text-3xl">
                          {formatDateTime(record.created_at)}
                        </p>

                        {record.source_url ? (
                          <div className="flex items-start gap-3 break-all text-xl font-medium text-slate-700 underline underline-offset-4 sm:text-2xl">
                            <span>{record.source_url}</span>
                            <ExternalLink className="mt-1 h-7 w-7 shrink-0 text-slate-500" />
                          </div>
                        ) : null}
                      </CardHeader>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
