"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("If an account exists, you’ll receive a reset link.");
    }

    setPending(false);
  }

  return (
    <PageShell>
      <SiteHeader links={[{ href: "/", label: "Home" }, { href: "/login", label: "Log in" }, { href: "/signup", label: "Sign up" }]} />

      <div className="mx-auto flex flex-1 items-center justify-center py-10">
        <Card className="w-full max-w-md border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Forgot password</CardTitle>
            <CardDescription className="text-slate-300">
              Enter your email and we’ll send you a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="forgot-email" className="text-sm font-medium text-slate-200">
                  Email
                </label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  className="border-white/10 bg-slate-950/70 text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:ring-emerald-500/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={pending}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:bg-slate-700 disabled:text-slate-400"
                disabled={pending}
              >
                {pending ? "Sending…" : "Send reset link"}
              </Button>
            </form>

            {message ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {message}
              </div>
            ) : null}

            <p className="mt-4 text-sm text-slate-300">
              Remembered it?{" "}
              <Link href="/login" className="font-medium text-emerald-300 underline underline-offset-4 hover:text-emerald-200">
                Back to login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
