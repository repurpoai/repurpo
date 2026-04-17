"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type FlashTone = "success" | "error" | "info";

const toneStyles: Record<FlashTone, { wrapper: string; icon: ReactNode }> = {
  success: {
    wrapper: "border-emerald-400/20 bg-emerald-400/10 text-emerald-50",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-300" />
  },
  error: {
    wrapper: "border-rose-400/20 bg-rose-400/10 text-rose-50",
    icon: <CircleAlert className="h-4 w-4 text-rose-300" />
  },
  info: {
    wrapper: "border-sky-400/20 bg-sky-400/10 text-sky-50",
    icon: <Info className="h-4 w-4 text-sky-300" />
  }
};

export function FlashBanner({
  title,
  message,
  tone = "success"
}: {
  title: string;
  message?: string | null;
  tone?: FlashTone;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setOpen(false), 3500);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!open) return null;

  const styles = toneStyles[tone];

  return (
    <div className="fixed left-1/2 top-5 z-50 w-[min(92vw,420px)] -translate-x-1/2">
      <div className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur", styles.wrapper)}>
        <div className="mt-0.5">{styles.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">{title}</div>
          {message ? <p className="mt-0.5 text-sm text-white/80">{message}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full p-1 text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label="Dismiss message"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
