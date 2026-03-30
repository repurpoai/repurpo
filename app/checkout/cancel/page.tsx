import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CheckoutCancelPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-0 bg-white shadow-soft">
          <CardHeader>
            <CardTitle>Checkout canceled</CardTitle>
            <CardDescription>
              No charge was completed. You can head back to pricing whenever you are ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to pricing
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
