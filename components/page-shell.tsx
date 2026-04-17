"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn("relative min-h-screen overflow-hidden bg-slate-950 text-slate-50", className)}>
      <div className="absolute inset-x-0 top-0 -z-10 h-[30rem] bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.18),transparent_40%),radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_28%)]" />
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </div>
    </main>
  );
}
