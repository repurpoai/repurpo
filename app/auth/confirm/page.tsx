import { Suspense } from "react";
import { LoaderCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmClient from "./confirm-client";

function ConfirmFallback() {
  return (
    <Card className="w-full border-white/10 bg-white text-slate-950 shadow-soft">
      <CardHeader>
        <CardTitle className="text-2xl">Confirming your email</CardTitle>
        <CardDescription>
          We&apos;re opening your verification link and signing you in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading confirmation details…
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConfirmPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
        <Suspense fallback={<ConfirmFallback />}>
          <ConfirmClient />
        </Suspense>
      </div>
    </main>
  );
}
