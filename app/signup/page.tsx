import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "@/app/signup/signup-form";
import { PageShell } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";

export default async function SignupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) {
    redirect("/dashboard");
  }

  return (
    <PageShell>
      <SiteHeader className="mb-6" links={[{ href: "/", label: "Home" }, { href: "/pricing", label: "Pricing" }, { href: "/login", label: "Log in" }]} />

      <section className="grid flex-1 items-center gap-8 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div className="hidden space-y-5 lg:block">
          <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
            Start on Free
          </div>
          <h1 className="max-w-xl text-4xl font-semibold leading-tight text-white">
            Create your account and start repurposing content.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-slate-300">
            Free users get 5 generations per month and Professional tone. Plus and Pro unlock unlimited generations, advanced tones, and image generation.
          </p>
        </div>

        <Card className="border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Create account</CardTitle>
            <CardDescription className="text-slate-300">
              Email/password auth powered by Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SignupForm />
            <p className="text-sm text-slate-300">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-emerald-300 underline underline-offset-4 hover:text-emerald-200">
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
