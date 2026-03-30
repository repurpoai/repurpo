"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CheckoutButton({
  plan,
  label,
  variant = "primary"
}: {
  plan: "plus" | "pro";
  label: string;
  variant?: "primary" | "secondary";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ plan })
      });

      const payload = (await response.json().catch(() => null)) as
        | { checkoutUrl?: string; error?: string }
        | null;

      if (!response.ok || !payload?.checkoutUrl) {
        throw new Error(payload?.error || "Could not start checkout.");
      }

      window.location.href = payload.checkoutUrl;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not start checkout.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={
          variant === "primary"
            ? "inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            : "inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
        }
      >
        {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
        {label}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
