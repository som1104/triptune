"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/* One component, two presentations (responsive rule §17): a bottom sheet up
   to 1200px, a centred 560px modal from there up. Same markup, same fields,
   same order — only the frame changes, so there is never a desktop-only
   variant of a flow to keep in sync. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const focusable = container?.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-soft/45 desk:items-center desk:p-10">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="relative flex max-h-[85dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl bg-surface desk:max-h-[760px] desk:w-[560px] desk:max-w-[560px] desk:rounded-3xl"
      >
        <span
          className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-hairline desk:hidden"
          aria-hidden="true"
        />
        <div className="flex shrink-0 items-center justify-between pl-5 pr-2 pt-3 desk:pl-6 desk:pr-3 desk:pt-6">
          <h2 id="sheet-title" className="m-0 mt-3 text-xl font-[650] leading-[1.25] text-ink desk:mt-0">
            {title}
          </h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="mt-2 flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-primary-soft desk:mt-0"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-2 pt-4 desk:gap-4 desk:px-6 desk:pt-2">
          {children}
        </div>

        {footer && (
          <div
            className="shrink-0 border-t border-hairline-soft px-5 pb-5 pt-3 desk:px-6 desk:pb-6 desk:pt-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
