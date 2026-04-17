import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/app/login/login-form";
import { PageShell } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) {
    redirect("/dashboard");
  }

  return (
    <PageShell>
      <SiteHeader links={[{ href: "/", label: "Home" }, { href: "/pricing", label: "Pricing" }, { href: "/signup", label: "Sign up" }]} />

      <section className="grid flex-1 items-center gap-8 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div className="hidden space-y-5 lg:block">
          <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
            Welcome back
          </div>
          <h1 className="max-w-xl text-4xl font-semibold leading-tight text-white">
            Log in to your content workspace.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-slate-300">
            Continue generating multi-platform posts, captions, threads, and newsletter drafts from links, YouTube videos, or raw text.
          </p>
        </div>

        <Card className="border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Log in</CardTitle>
            <CardDescription className="text-slate-300">
              Enter your email and password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <LoginForm />
            <p className="text-sm text-slate-300">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-emerald-300 underline underline-offset-4 hover:text-emerald-200">
                Create one
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
