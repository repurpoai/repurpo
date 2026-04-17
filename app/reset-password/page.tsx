"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Password updated successfully! You can now log in.");
    }

    setPending(false);
  }

  return (
    <PageShell>
      <SiteHeader className="mb-6" links={[{ href: "/", label: "Home" }, { href: "/login", label: "Log in" }, { href: "/signup", label: "Sign up" }]} />

      <div className="mx-auto flex flex-1 items-center justify-center py-10">
        <Card className="w-full max-w-md border-white/10 bg-white/5 text-slate-50 shadow-soft backdrop-blur">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Set new password</CardTitle>
            <CardDescription className="text-slate-300">
              Choose a strong password to secure your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="reset-password" className="text-sm font-medium text-slate-200">
                  New password
                </label>
                <Input
                  id="reset-password"
                  type="password"
                  placeholder="Enter new password"
                  className="border-white/10 bg-slate-950/70 text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:ring-emerald-500/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={pending}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:bg-slate-700 disabled:text-slate-400"
                disabled={pending}
              >
                {pending ? "Updating…" : "Update password"}
              </Button>
            </form>

            {message ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {message}
              </div>
            ) : null}

            <p className="mt-4 text-sm text-slate-300">
              Back to{" "}
              <Link href="/login" className="font-medium text-emerald-300 underline underline-offset-4 hover:text-emerald-200">
                login
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
