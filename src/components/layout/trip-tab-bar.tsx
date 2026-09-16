"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, CheckSquare } from "lucide-react";

export function TripTabBar({ tripId }: { tripId: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: `/trip/${tripId}`, label: "홈", icon: Home, match: (p: string) => p === `/trip/${tripId}` },
    {
      href: `/trip/${tripId}/consensus`,
      label: "합의",
      icon: Users,
      match: (p: string) => p.startsWith(`/trip/${tripId}/consensus`),
    },
    {
      href: `/trip/${tripId}/stay`,
      label: "투표",
      icon: CheckSquare,
      match: (p: string) => p.startsWith(`/trip/${tripId}/stay`),
    },
  ];

  return (
    <nav
      className="grid shrink-0 grid-cols-3 border-t border-hairline bg-surface"
      style={{ paddingBottom: "var(--safe-area-bottom)" }}
    >
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 border-t-2 text-xs font-semibold ${
              active ? "border-ink text-ink" : "border-transparent text-text-muted"
            }`}
          >
            <tab.icon size={22} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
