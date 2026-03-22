"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, History, Home, LogOut, Wallet } from "lucide-react";
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
  usageWindowLabel: string;
};

const navItems = [
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
    href: "/pricing",
    label: "Pricing",
    icon: Wallet
  }
];

export function Sidebar({
  userName,
  userEmail,
  tier,
  usedThisMonth,
  monthlyLimit,
  remainingThisMonth,
  usageWindowLabel
}: SidebarProps) {
  const pathname = usePathname();
  const displayName = userName?.trim() || userEmail?.split("@")[0] || "Workspace";
  const usagePercent =
    monthlyLimit === null ? 0 : Math.min((usedThisMonth / monthlyLimit) * 100, 100);

  return (
    <Card className="w-full border-0 bg-slate-950 p-4 text-slate-50 shadow-soft lg:sticky lg:top-6 lg:w-72 lg:self-start">
      <div className="flex flex-col gap-6">
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Profile</div>
          <div className="space-y-1">
            <div className="text-xl font-semibold text-white">{displayName}</div>
            {userEmail ? <div className="break-all text-sm text-slate-400">{userEmail}</div> : null}
          </div>
          <PlanBadge tier={tier} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
            <Crown className="h-4 w-4" />
            Usage
          </div>

          {monthlyLimit === null ? (
            <div className="space-y-1">
              <div className="text-sm font-medium text-white">Unlimited generations</div>
              <p className="text-xs text-slate-400">All tones and export buttons unlocked.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-medium text-white">
                {usedThisMonth}/{monthlyLimit} used in {usageWindowLabel}
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-white"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                {remainingThisMonth} generations remaining this month.
              </p>
            </div>
          )}
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
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
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Settings / Logout</div>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary" className="w-full justify-start">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </form>
        </div>
      </div>
    </Card>
  );
}