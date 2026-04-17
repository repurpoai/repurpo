"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TurnstileWidget } from "@/components/turnstile-widget";

export function SignupForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const [resetSignal, setResetSignal] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      formData.set("captchaToken", captchaToken);

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; redirectTo?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Signup failed.");
        setResetSignal((value) => value + 1);
        return;
      }

      window.location.assign(payload?.redirectTo ?? "/dashboard");
    } catch {
      setError("Signup failed. Try again.");
      setResetSignal((value) => value + 1);
    } finally {
      setPending(false);
    }
  }

  const fieldClassName =
    "border-white/10 bg-slate-950/70 text-slate-50 placeholder:text-slate-500 focus:border-emerald-400 focus:ring-emerald-500/20";

  return (
    <form onSubmit={handleSubmit} method="post" action="/api/auth/signup" encType="multipart/form-data" className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="signup-fullname" className="text-sm font-medium text-slate-200">
          Full name
        </label>
        <Input
          id="signup-fullname"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="Optional"
          disabled={pending}
          className={fieldClassName}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="signup-email" className="text-sm font-medium text-slate-200">
          Email
        </label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={pending}
          required
          className={fieldClassName}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="signup-password" className="text-sm font-medium text-slate-200">
          Password
        </label>
        <Input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          disabled={pending}
          required
          className={fieldClassName}
        />
      </div>

      <TurnstileWidget action="signup" onTokenChange={setCaptchaToken} resetSignal={resetSignal} />

      {error ? (
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <Button
        type="submit"
        className="w-full bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:bg-slate-700 disabled:text-slate-400"
        disabled={pending || !captchaToken}
      >
        {pending ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          "Sign up"
        )}
      </Button>
    </form>
  );
}
