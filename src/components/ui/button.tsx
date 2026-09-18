"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

/* Mirrors the design system's Button (components/core/Button.jsx):
   base  — inline-flex, gap 8, height var(--control-h)=44, padding 0 16,
           radius full, 16px / 1.38 / weight 600, 1px transparent border
   sizes — sm 36 / 14px / 0 12 · md (default) · lg 52 / 0 24
   icon  — rendered AFTER the label unless iconPosition="start" */
type Variant = "primary" | "soft" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:opacity-90",
  soft: "bg-primary-soft text-ink hover:opacity-90",
  outline: "border-hairline bg-surface text-ink hover:bg-primary-soft",
  ghost: "bg-transparent text-ink hover:bg-primary-soft",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-base",
  lg: "h-[52px] px-6 text-base",
};

function buttonClassName(
  variant: Variant,
  size: Size,
  fullWidth: boolean | undefined,
  className: string
) {
  return `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent font-semibold leading-[1.38] transition-[opacity,background-color] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-40 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "start" | "end";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth,
    loading,
    icon,
    iconPosition = "end",
    disabled,
    className = "",
    children,
    ...props
  },
  ref
) {
  const glyph = loading ? (
    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
  ) : (
    icon
  );

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClassName(variant, size, fullWidth, className)}
      {...props}
    >
      {iconPosition === "start" && glyph}
      {children}
      {iconPosition === "end" && glyph}
    </button>
  );
});

// Renders a single <a> styled like Button, for navigation. Never nest
// <Button> inside <Link> — an <a><button> pair is invalid HTML and breaks
// both click handling and assistive tech.
export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  fullWidth,
  icon,
  iconPosition = "end",
  external,
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "start" | "end";
  external?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const content = (
    <>
      {iconPosition === "start" && icon}
      {children}
      {iconPosition === "end" && icon}
    </>
  );
  const cls = buttonClassName(variant, size, fullWidth, className);

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={cls}>
      {content}
    </Link>
  );
}
