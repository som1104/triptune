"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "@/components/layout/container";
import { ProfileMenu, GuestChip } from "@/components/auth/profile-menu";

/* Desktop counterpart of TripTabBar. Only one of the two is ever mounted:
   this is hidden below 1200px, the tab bar is hidden from 1200px up. */
export function TripTopNav({ tripId }: { tripId?: string }) {
  const pathname = usePathname();

  const links = tripId
    ? [
        { href: `/trip/${tripId}`, label: "홈", match: (p: string) => p === `/trip/${tripId}` },
        {
          href: `/trip/${tripId}/consensus`,
          label: "그룹 합의",
          match: (p: string) => p.startsWith(`/trip/${tripId}/consensus`),
        },
        {
          href: `/trip/${tripId}/stay`,
          label: "숙소 투표",
          match: (p: string) => p.startsWith(`/trip/${tripId}/stay`),
        },
      ]
    : [];

  return (
    <header className="sticky top-0 z-40 hidden shrink-0 border-b border-hairline bg-surface desk:block">
      <Container className="flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-base font-[650] tracking-[0.01em] text-ink">
            TRIPTUNE
          </Link>
          {links.length > 0 && (
            <nav className="flex items-center gap-1">
              {links.map((l) => {
                const active = l.match(pathname);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    // 보고 있는 탭을 다시 누르면 같은 화면을 새로 받아온다.
                    onClick={active ? (e) => e.preventDefault() : undefined}
                    className={`flex h-11 items-center rounded-full px-4 text-sm font-semibold ${
                      active ? "bg-primary-soft text-ink" : "text-text-muted hover:bg-primary-soft"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-11 items-center rounded-full px-3 text-sm font-semibold text-text-muted hover:bg-primary-soft"
          >
            내 여행
          </Link>
          <GuestChip />
          <ProfileMenu />
        </div>
      </Container>
    </header>
  );
}
