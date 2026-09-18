"use client";

import { forwardRef, useId } from "react";

/* Mirrors the design system's TextInput: no border, tint fill (--field),
   16px radius, 44px tall, and a 2px inset ink ring on focus. */
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, hint, error, id, className = "", ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold leading-[1.33] text-ink">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={!!error}
        className={`h-11 w-full rounded-2xl border-0 bg-field px-4 py-3 text-base font-[450] text-ink outline-none transition-shadow duration-[120ms] placeholder:text-text-faint ${
          error
            ? "shadow-[inset_0_0_0_2px_var(--conflict-text)]"
            : "focus:shadow-[inset_0_0_0_2px_var(--focus-ring)]"
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-xs font-medium leading-[1.33] text-conflict-text">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs leading-[1.33] text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
