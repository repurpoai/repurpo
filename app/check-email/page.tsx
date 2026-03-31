import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CheckEmailPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden space-y-5 lg:block">
          <div className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sm text-sky-200">
            One more step
          </div>
          <h1 className="text-4xl font-semibold leading-tight text-white">
            Confirm your email to finish creating your account.
          </h1>
          <p className="max-w-xl text-lg text-slate-300">
            We just sent you a confirmation link. Open that email and tap the button to verify your address and continue straight into your workspace.
          </p>
        </div>

        <Card className="border-white/10 bg-white text-slate-950 shadow-soft">
          <CardHeader>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              Your account was created. Verify your email to activate it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-800">
              After you tap the confirmation link, you should be signed in automatically.
            </div>
            <p>
              If you do not see the message, check spam or promotions and make sure you opened the newest verification email.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 font-medium text-white transition hover:bg-slate-800"
              >
                Back to login
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Use another email
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
