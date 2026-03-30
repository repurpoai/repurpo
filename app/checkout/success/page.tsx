import Link from "next/link";
import { CheckCircle2, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanBadge } from "@/components/plan-badge";
import { getViewerContext } from "@/lib/viewer";

export default async function CheckoutSuccessPage() {
  const viewer = await getViewerContext();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-0 bg-gradient-to-br from-slate-950 to-slate-800 text-white shadow-soft">
          <CardHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-slate-200">
              <CheckCircle2 className="h-4 w-4" />
              Checkout complete
            </div>
            <CardTitle className="text-3xl text-white">Your payment went through</CardTitle>
            <CardDescription className="text-slate-300">
              Repurpo updates your plan through a Dodo Payments webhook. If the badge below still shows Free, refresh this page in a few seconds.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-0 bg-white shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-950">
              <Crown className="h-5 w-5" />
              Current plan
            </CardTitle>
            <CardDescription>
              Once the webhook lands, your Plus or Pro access turns on automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PlanBadge tier={viewer?.tier ?? "free"} />
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Go to dashboard
              </Link>
              <Link
                href="/profile"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
              >
                Open profile
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
