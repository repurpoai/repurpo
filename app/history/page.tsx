import { redirect } from "next/navigation";
import {
  ExternalLink,
  FileText,
  History as HistoryIcon,
  Link2,
  Megaphone
} from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { ExportButton } from "@/components/export-button";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TONE_META, type ContentTone } from "@/lib/plans";
import { formatDateTime, getSourceLabel, slugify } from "@/lib/utils";
import { getViewerContext } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";

type GenerationRecord = {
  id: string;
  input_mode: "link" | "text";
  tone: ContentTone;
  source_url: string | null;
  source_title: string | null;
  source_text: string;
  linkedin_post: string;
  twitter_thread: string;
  newsletter: string;
  created_at: string;
};

export default async function HistoryPage() {
  const viewer = await getViewerContext();

  if (!viewer) {
    redirect("/login");
  }

  const upgradeHref = process.env.NEXT_PUBLIC_PRO_UPGRADE_URL?.trim() || "/pricing";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generations")
    .select(
      "id, input_mode, tone, source_url, source_title, source_text, linkedin_post, twitter_thread, newsletter, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const records = (data ?? []) as GenerationRecord[];

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
          usageWindowLabel={viewer.usageWindowLabel}
        />

        <section className="min-w-0 flex-1 space-y-6">
          <Card className="border-0 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-soft">
            <CardHeader>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-slate-200">
                <HistoryIcon className="h-4 w-4" />
                My history
              </div>
              <CardTitle className="text-3xl">Your saved generations</CardTitle>
              <CardDescription className="text-slate-300">
                Each record belongs only to the account that created it.
              </CardDescription>
            </CardHeader>
          </Card>

          {!viewer.isPro ? (
            <Card className="border-0 bg-white shadow-soft">
              <CardContent className="flex flex-col gap-3 py-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    Copy is included on Free. Direct export and advanced tones are Pro features.
                  </p>
                  <p className="text-sm text-slate-500">
                    Upgrade to unlock export buttons and the Casual, Viral, and Authority tones.
                  </p>
                </div>
                <a
                  href={upgradeHref}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Upgrade to Pro
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
            <div className="space-y-5">
              {records.map((record) => {
                const sourceLabel = getSourceLabel(record.source_title, record.source_url);
                const fileBase = slugify(sourceLabel || "generation");

                return (
                  <Card key={record.id} className="border-0 bg-white shadow-soft">
                    <CardHeader className="gap-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <CardTitle className="text-xl text-slate-950">{sourceLabel}</CardTitle>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            <span className="rounded-full bg-slate-100 px-3 py-1 capitalize">
                              {record.input_mode}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1">
                              {TONE_META[record.tone].label}
                            </span>
                            <span>{formatDateTime(record.created_at)}</span>
                          </div>
                          {record.source_url ? (
                            <a
                              href={record.source_url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-1 break-all text-sm font-medium text-slate-700 underline underline-offset-4"
                            >
                              {record.source_url}
                              <ExternalLink className="h-4 w-4 shrink-0" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      <section className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                            <Megaphone className="h-4 w-4" />
                            LinkedIn post
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <CopyButton text={record.linkedin_post} label="Copy" />
                            <ExportButton
                              text={record.linkedin_post}
                              filename={`${fileBase}-linkedin.txt`}
                              disabled={!viewer.isPro}
                            />
                            {!viewer.isPro ? (
                              <a
                                href={upgradeHref}
                                className="text-xs font-medium text-slate-900 underline underline-offset-4"
                              >
                                Unlock export
                              </a>
                            ) : null}
                          </div>
                        </div>
                        <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                          {record.linkedin_post}
                        </div>
                      </section>

                      <section className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                            <Link2 className="h-4 w-4" />
                            Twitter/X thread
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <CopyButton text={record.twitter_thread} label="Copy" />
                            <ExportButton
                              text={record.twitter_thread}
                              filename={`${fileBase}-thread.txt`}
                              disabled={!viewer.isPro}
                            />
                            {!viewer.isPro ? (
                              <a
                                href={upgradeHref}
                                className="text-xs font-medium text-slate-900 underline underline-offset-4"
                              >
                                Unlock export
                              </a>
                            ) : null}
                          </div>
                        </div>
                        <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                          {record.twitter_thread}
                        </div>
                      </section>

                      <section className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                            <FileText className="h-4 w-4" />
                            Newsletter
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <CopyButton text={record.newsletter} label="Copy" />
                            <ExportButton
                              text={record.newsletter}
                              filename={`${fileBase}-newsletter.txt`}
                              disabled={!viewer.isPro}
                            />
                            {!viewer.isPro ? (
                              <a
                                href={upgradeHref}
                                className="text-xs font-medium text-slate-900 underline underline-offset-4"
                              >
                                Unlock export
                              </a>
                            ) : null}
                          </div>
                        </div>
                        <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                          {record.newsletter}
                        </div>
                      </section>

                      <details className="rounded-2xl border border-slate-200 bg-white">
                        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-900">
                          View original source text
                        </summary>
                        <div className="border-t border-slate-200 px-4 py-4">
                          <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                            {record.source_text}
                          </div>
                        </div>
                      </details>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}