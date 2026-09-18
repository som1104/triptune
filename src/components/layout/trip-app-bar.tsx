"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { ProfileMenu } from "@/components/auth/profile-menu";

export interface TripAppBarAction {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
}

/* TripAppBar.dc.html — 56px tall, white, no bottom rule. The title is
   centred between a fixed 44px back slot and the action slot, so it stays
   optically centred whether or not there is a back button.

   Pinned to the top on mobile: on a long screen like 내 날짜·취향 the back
   arrow is the only way out, and it should not take a full scroll to reach.
   z-30 sits under the modal (z-50) and the bottom bars (z-40). */
export function TripAppBar({
  title,
  back,
  onBack,
  actions = [],
  profile,
}: {
  title: string;
  back?: boolean;
  onBack?: () => void;
  actions?: TripAppBarAction[];
  /** shows the 게스트 / 계정 popover in the right slot */
  profile?: boolean;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 bg-surface px-2 desk:hidden">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center">
        {back && (
          <button
            type="button"
            aria-label="뒤로"
            onClick={() => (onBack ? onBack() : router.back())}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-primary-soft"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-[1.3] text-ink">
        {title}
      </div>

      <div className="flex min-w-11 shrink-0 justify-end">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            aria-label={action.label}
            onClick={action.onClick}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-primary-soft"
          >
            <action.icon size={20} aria-hidden="true" />
          </button>
        ))}
        {profile && <ProfileMenu />}
      </div>
    </header>
  );
}
