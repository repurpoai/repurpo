"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TurnstileWidget } from "@/components/turnstile-widget";

export function LoginForm() {
  const searchParams = useSearchParams();
  const notice = useMemo(() => searchParams.get("notice"), [searchParams]);
  const queryError = useMemo(() => searchParams.get("error"), [searchParams]);
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

      const response = await fetch("/api/auth/login", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; redirectTo?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Login failed.");
        setResetSignal((value) => value + 1);
        return;
      }

      window.location.assign(payload?.redirectTo ?? "/dashboard");
    } catch {
      setError("Login failed. Try again.");
      setResetSignal((value) => value + 1);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} method="post" action="/api/auth/login" encType="multipart/form-data" className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="login-email" className="text-sm font-medium text-slate-700">
          Email
        </label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={pending}
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="login-password" className="text-sm font-medium text-slate-700">
          Password
        </label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={pending}
          required
        />
      </div>

      <TurnstileWidget action="login" onTokenChange={setCaptchaToken} resetSignal={resetSignal} />

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      {queryError && !error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {queryError}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending || !captchaToken}>
        {pending ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Logging in...
          </>
        ) : (
          "Log in"
        )}
      </Button>
    </form>
  );
}
