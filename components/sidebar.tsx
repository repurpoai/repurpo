"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  History,
  Home,
  Image as ImageIcon,
  LogOut,
  Menu,
  Scale,
  Shield,
  Sparkles,
  User,
  Wallet,
  X
} from "lucide-react";
import { logoutAction } from "@/app/auth/actions";
import { PlanBadge } from "@/components/plan-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type PlanTier } from "@/lib/plans";
import { cn } from "@/lib/utils";

type SidebarProps = {
  userName: string | null;
  userEmail: string | null;
  tier: PlanTier;
  usedThisMonth: number;
  monthlyLimit: number | null;
  remainingThisMonth: number | null;
  imageUsedThisMonth: number;
  imageMonthlyLimit: number | null;
  imageRemainingThisMonth: number | null;
  usageWindowLabel: string;
  isAdmin?: boolean;
};

const baseNavItems = [
  {
    href: "/dashboard",
    label: "New Generation",
    icon: Home
  },
  {
    href: "/history",
    label: "My History",
    icon: History
  },
  {
    href: "/profile",
    label: "Profile",
    icon: User
  },
  {
    href: "/pricing",
    label: "Pricing",
    icon: Wallet
  }
];

const legalItems = [
  {
    href: "/privacy-policy.html",
    label: "Privacy Policy",
    icon: Shield
  },
  {
    href: "/terms-of-service.html",
    label: "Terms of Service",
    icon: FileText
  },
  {
    href: "/refund-policy.html",
    label: "Refund Policy",
    icon: Scale
  }
];

export function Sidebar({
  userName,
  userEmail,
  tier,
  usedThisMonth,
  monthlyLimit,
  remainingThisMonth,
  imageUsedThisMonth,
  imageMonthlyLimit,
  imageRemainingThisMonth,
  usageWindowLabel,
  isAdmin = false
}: SidebarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = userName?.trim() || userEmail?.split("@")[0] || "Workspace";
  const textUsagePercent =
    monthlyLimit === null ? 0 : Math.min((usedThisMonth / monthlyLimit) * 100, 100);
  const imageUsagePercent =
    imageMonthlyLimit === null
      ? 0
      : Math.min((imageUsedThisMonth / imageMonthlyLimit) * 100, 100);

  const navItems = useMemo(
    () => (isAdmin ? [...baseNavItems, { href: "/admin", label: "Admin", icon: Shield }] : baseNavItems),
    [isAdmin]
  );

  const activeLabel = useMemo(
    () => navItems.find((item) => pathname === item.href)?.label ?? "Menu",
    [pathname, navItems]
  );

  const sidebarBody = (
    <div className="flex flex-col gap-6">
      <Link href="/" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 shadow-lg shadow-emerald-400/5">
          <Sparkles className="h-5 w-5 text-emerald-300" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-base font-semibold text-white">Repurpo</span>
          <span className="block text-xs text-slate-400">AI content repurposer</span>
        </span>
      </Link>

      <div className="space-y-3">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Profile</div>
        <div className="space-y-1">
          <div className="text-xl font-semibold text-white">{displayName}</div>
          {userEmail ? <div className="break-all text-sm text-slate-400">{userEmail}</div> : null}
        </div>
        <PlanBadge tier={tier} />
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {monthlyLimit === null ? (
            <div className="space-y-1">
              <div className="text-sm font-medium text-white">Unlimited text generations</div>
              <p className="text-xs text-slate-400">
                Your current plan has no monthly text generation cap.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-medium text-white">
                {usedThisMonth}/{monthlyLimit} text used in {usageWindowLabel}
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-white" style={{ width: `${textUsagePercent}%` }} />
              </div>
              <p className="text-xs text-slate-400">
                {remainingThisMonth} text generations remaining this month.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {imageMonthlyLimit === null ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <ImageIcon className="h-4 w-4" />
                Unlimited images
              </div>
              <p className="text-xs text-slate-400">
                Your current plan has no monthly image cap.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <ImageIcon className="h-4 w-4" />
                {imageUsedThisMonth}/{imageMonthlyLimit} images used in {usageWindowLabel}
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-white" style={{ width: `${imageUsagePercent}%` }} />
              </div>
              <p className="text-xs text-slate-400">
                {imageRemainingThisMonth} images remaining this month.
              </p>
            </div>
          )}
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                active
                  ? "bg-white text-slate-950"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-white/10 pt-4">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Legal</div>
        <nav className="space-y-2">
          {legalItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 border-t border-white/10 pt-4">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Settings / Logout</div>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary" className="w-full justify-start">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden">
        <Button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="w-full justify-between rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.95)_0%,rgba(2,6,23,0.98)_100%)] px-4 py-5 text-left text-white shadow-[0_18px_45px_-24px_rgba(15,23,42,0.9)] ring-1 ring-white/5"
        >
          <span className="flex items-center gap-3 text-base font-semibold">
            <Menu className="h-5 w-5 text-slate-100" />
            <span className="text-white">{activeLabel}</span>
          </span>
          <span className="flex items-center gap-2">
            <PlanBadge tier={tier} />
          </span>
        </Button>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex h-full w-[min(88vw,23rem)] max-w-full flex-col overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.12),transparent_25%),linear-gradient(180deg,#0f172a_0%,#020617_100%)] text-slate-50 shadow-[20px_0_50px_rgba(15,23,42,0.5)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Menu</div>
                <div className="mt-1 text-lg font-semibold text-white">Navigation</div>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                onClick={() => setMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-8 [scrollbar-width:thin]">
              {sidebarBody}
            </div>
          </div>
        </div>
      ) : null}

      <Card className="hidden w-full border border-white/10 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_34%),radial-gradient(circle_at_70%_0%,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,#0f172a_0%,#020617_100%)] p-4 text-slate-50 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.9)] lg:sticky lg:top-6 lg:block lg:max-h-[calc(100dvh-3rem)] lg:w-72 lg:self-start lg:overflow-y-auto">
        {sidebarBody}
      </Card>
    </>
  );
}
