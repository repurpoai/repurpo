import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Link2,
  Megaphone,
  MessageSquareQuote,
  Newspaper
} from "lucide-react";
import type { ComponentType } from "react";
import { CopyButton } from "@/components/copy-button";
import { ExportButton } from "@/components/export-button";
import { OpenInAppButton } from "@/components/open-in-app-button";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLATFORM_META, TONE_META, type ContentPlatform, type ContentTone, type LengthPreset } from "@/lib/plans";
import { formatDateTime, getSourceLabel, slugify } from "@/lib/utils";
import { getViewerContext } from "@/lib/viewer";
import { createClient } from "@/lib/supabase/server";

type GenerationRecord = {
  id: string;
  input_mode: "link" | "text" | "youtube";
  tone: ContentTone;
  length_preset: LengthPreset;
  source_url: string | null;
  source_title: string | null;
  source_text: string;
  selected_platforms: ContentPlatform[] | null;
  outputs: Record<string, string> | null;
  linkedin_post: string;
  twitter_thread: string;
  newsletter: string;
  created_at: string;
};

const platformIcons: Record<ContentPlatform, ComponentType<{ className?: string }>> = {
  linkedin: Megaphone,
  x: Link2,
  instagram: FileText,
  reddit: MessageSquareQuote,
  newsletter: Newspaper
};

export default async function HistoryDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getViewerContext();

  if (!viewer) {
    redirect("/login");
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generations")
    .select(
      "id, input_mode, tone, length_preset, source_url, source_title, source_text, selected_platforms, outputs, linkedin_post, twitter_thread, newsletter, created_at"
    )
    .eq("id", id)
    .eq("user_id", viewer.userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    notFound();
  }

  const record = data as GenerationRecord;
  const sourceLabel = getSourceLabel(record.source_title, record.source_url);
  const fileBase = slugify(sourceLabel || "generation");

  const dynamicOutputs =
    record.outputs && Object.keys(record.outputs).length > 0
      ? (record.outputs as Partial<Record<ContentPlatform, string>>)
      : ({
          linkedin: record.linkedin_post || undefined,
          x: record.twitter_thread || undefined,
          newsletter: record.newsletter || undefined
        } as Partial<Record<ContentPlatform, string>>);

  const selectedPlatforms =
    record.selected_platforms && record.selected_platforms.length > 0
      ? record.selected_platforms
      : (Object.keys(dynamicOutputs) as ContentPlatform[]);

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
          <Link
            href="/history"
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-soft transition hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to history
          </Link>

          <Card className="border-0 bg-white shadow-soft">
            <CardHeader className="gap-4">
              <CardTitle className="text-2xl text-slate-950 sm:text-3xl">{sourceLabel}</CardTitle>

              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-1 capitalize">
                  {record.input_mode}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  {TONE_META[record.tone]?.label ?? record.tone}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 capitalize">
                  {record.length_preset}
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
            </CardHeader>
          </Card>

          {!viewer.isPaid ? (
            <Card className="border-0 bg-white shadow-soft">
              <CardContent className="py-5">
                <p className="text-sm text-slate-500">
                  Export and image workflows are reserved for paid plans.
                </p>
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-5">
            {selectedPlatforms.map((platform) => {
              const text = dynamicOutputs[platform];
              if (!text) return null;

              const Icon = platformIcons[platform] ?? FileText;

              return (
                <Card key={platform} className="border-0 bg-white shadow-soft">
                  <CardHeader className="gap-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                          <Icon className="h-5 w-5" />
                          {PLATFORM_META[platform].label}
                        </CardTitle>
                        <CardDescription>{PLATFORM_META[platform].description}</CardDescription>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <CopyButton text={text} label="Copy" />
                        <ExportButton
                          text={text}
                          filename={`${fileBase}-${platform}.txt`}
                          disabled={!viewer.isPaid}
                        />
                        {platform !== "newsletter" ? (
                          <OpenInAppButton platform={platform} text={text} sourceTitle={sourceLabel} />
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                      {text}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <details className="rounded-2xl border border-slate-200 bg-white shadow-soft">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-900">
              View original source text
            </summary>
            <div className="border-t border-slate-200 px-4 py-4">
              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {record.source_text}
              </div>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
