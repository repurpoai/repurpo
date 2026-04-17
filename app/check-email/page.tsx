import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";

export default function CheckEmailPage() {
  return (
    <PageShell>
      <SiteHeader className="mb-6" links={[{ href: "/", label: "Home" }, { href: "/login", label: "Log in" }, { href: "/pricing", label: "Pricing" }]} />

      <section className="grid flex-1 items-center gap-8 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div className="hidden space-y-5 lg:block">
          <div className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sm text-sky-200">
            One more step
          </div>
          <h1 className="max-w-xl text-4xl font-semibold leading-tight text-white">
            Confirm your email to finish creating your account.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-slate-300">
            We just sent you a confirmation link. Open that email and tap the button to verify your address and continue straight into your workspace.
          </p>
        </div>

        <Card className="border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Check your email</CardTitle>
            <CardDescription className="text-slate-300">
              Your account was created. Verify your email to activate it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sky-100">
              After you tap the confirmation link, you should be signed in automatically.
            </div>
            <p>
              If you do not see the message, check spam or promotions and make sure you opened the newest verification email.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 font-medium text-slate-950 transition hover:bg-slate-200"
              >
                Back to login
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-medium text-slate-100 transition hover:bg-white/10"
              >
                Use another email
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
