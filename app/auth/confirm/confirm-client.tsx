"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { type EmailOtpType } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}

function normalizeMessage(value: string | null) {
  if (!value) {
    return null;
  }

  return value.replace(/\+/g, " ");
}

export default function ConfirmClient() {
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => getSafeNextPath(searchParams.get("next")), [searchParams]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function confirm() {
      const supabase = createClient();
      const tokenHash = searchParams.get("token_hash");
      const queryType = searchParams.get("type") as EmailOtpType | null;
      const code = searchParams.get("code");
      const queryError = normalizeMessage(searchParams.get("error_description") ?? searchParams.get("error"));

      if (queryError) {
        if (isMounted) {
          setError(queryError);
        }
        return;
      }

      try {
        if (tokenHash && queryType) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: queryType
          });

          if (verifyError) {
            throw verifyError;
          }
        } else if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw exchangeError;
          }
        } else {
          const hashParams = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash);
          const hashError = normalizeMessage(hashParams.get("error_description") ?? hashParams.get("error"));

          if (hashError) {
            throw new Error(hashError);
          }

          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (!accessToken || !refreshToken) {
            throw new Error("This confirmation link is invalid or expired. Please request a fresh one.");
          }

          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (sessionError) {
            throw sessionError;
          }
        }

        window.location.replace(nextPath);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "This confirmation link is invalid or expired. Please log in again.";

        if (isMounted) {
          setError(message);
        }
      }
    }

    confirm();

    return () => {
      isMounted = false;
    };
  }, [nextPath, searchParams]);

  return (
    <Card className="w-full border-white/10 bg-white text-slate-950 shadow-soft">
      <CardHeader>
        <CardTitle className="text-2xl">Confirming your email</CardTitle>
        <CardDescription>
          We&apos;re finishing your sign-in and taking you to your dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                Go to login
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                Create another account
              </Link>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Finishing verification…
          </div>
        )}
      </CardContent>
    </Card>
  );
}
