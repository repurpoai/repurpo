import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "@/app/signup/signup-form";

export default async function SignupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-50">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden space-y-5 lg:block">
          <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200">
            Start on Free
          </div>
          <h1 className="text-4xl font-semibold leading-tight text-white">
            Create your account and start repurposing content.
          </h1>
          <p className="max-w-xl text-lg text-slate-300">
            Free users get 5 generations per month and Professional tone. Pro unlocks unlimited
            generations and advanced tones.
          </p>
        </div>

        <Card className="border-white/10 bg-white text-slate-950 shadow-soft">
          <CardHeader>
            <CardTitle className="text-2xl">Create account</CardTitle>
            <CardDescription>
              Email/password auth powered by Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SignupForm />
            <p className="text-sm text-slate-600">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-slate-950 underline underline-offset-4">
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}