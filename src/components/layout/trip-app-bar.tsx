"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, type LucideIcon } from "lucide-react";

export interface TripAppBarAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

export function TripAppBar({
  title,
  back,
  onBack,
  actions = [],
}: {
  title: string;
  back?: boolean;
  onBack?: () => void;
  actions?: TripAppBarAction[];
}) {
  const router = useRouter();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-hairline-soft px-2">
      {back ? (
        <button
          aria-label="뒤로 가기"
          onClick={() => (onBack ? onBack() : router.back())}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-primary-soft"
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
      ) : (
        <span className="w-2" />
      )}
      <h1 className="flex-1 truncate text-[15px] font-semibold text-ink">{title}</h1>
      {actions.map((action) => (
        <button
          key={action.label}
          aria-label={action.label}
          onClick={action.onClick}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-primary-soft"
        >
          <action.icon size={20} aria-hidden="true" />
        </button>
      ))}
      {actions.length === 0 && <span className="w-2" />}
    </header>
  );
}
