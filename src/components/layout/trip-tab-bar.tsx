"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* TripTabBar.dc.html — 64px, 3 equal columns, 1px top rule, no active
   indicator bar: the active tab is signalled by ink-1 vs ink-3 alone.
   The glyphs are the design's own 24-box paths (a squarer house, an
   asymmetric pair, a ballot tick), not their nearest Lucide equivalents. */
const ICONS = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-5.5h5V20" />
    </>
  ),
  consensus: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16.5 6.2a3.2 3.2 0 0 1 0 6" />
      <path d="M17.5 14.6A5.5 5.5 0 0 1 20.5 20" />
    </>
  ),
  vote: (
    <>
      <path d="m8.5 12.5 2.5 2.5 5-5.5" />
      <rect x="3.5" y="4" width="17" height="12" rx="2" />
      <path d="M2.5 19.5h19" />
    </>
  ),
} as const;

function TabIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

export function TripTabBar({ tripId }: { tripId: string }) {
  const pathname = usePathname();

  const tabs = [
    {
      href: `/trip/${tripId}`,
      label: "홈",
      icon: "home" as const,
      match: (p: string) => p === `/trip/${tripId}`,
    },
    {
      href: `/trip/${tripId}/consensus`,
      label: "합의",
      icon: "consensus" as const,
      match: (p: string) => p.startsWith(`/trip/${tripId}/consensus`),
    },
    {
      href: `/trip/${tripId}/stay`,
      label: "투표",
      icon: "vote" as const,
      match: (p: string) => p.startsWith(`/trip/${tripId}/stay`),
    },
  ];

  return (
    // sticky (not fixed) keeps the bar inside the 480px column and inside the
    // normal flow, so it pins to the bottom of the viewport while scrolling
    // and settles naturally at the end of the page — no manual width math and
    // no content hidden under a fixed overlay at the very bottom.
    <nav
      className="sticky bottom-0 z-40 grid shrink-0 grid-cols-3 border-t border-hairline bg-surface desk:hidden"
      style={{ paddingBottom: "var(--safe-area-bottom)" }}
    >
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold leading-[1.33] ${
              active ? "text-ink" : "text-text-muted"
            }`}
          >
            <TabIcon name={tab.icon} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
