"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type SiteHeaderLink = {
  href: string;
  label: string;
};

export function SiteHeader({
  links = [],
  className
}: {
  links?: SiteHeaderLink[];
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <Link href="/" className="inline-flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 shadow-lg shadow-emerald-400/5">
          <Sparkles className="h-5 w-5 text-emerald-300" />
        </span>
        <span className="leading-tight">
          <span className="block text-base font-semibold text-white">Repurpo</span>
          <span className="block text-xs text-slate-400">AI content repurposer</span>
        </span>
      </Link>

      {links.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
