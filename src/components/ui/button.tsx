"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "soft" | "outline" | "ghost";
type Size = "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:opacity-90",
  soft: "bg-primary-soft text-ink-soft hover:opacity-90",
  outline: "border border-hairline bg-surface text-ink-soft hover:bg-primary-soft",
  ghost: "bg-transparent text-ink hover:bg-primary-soft",
};

const sizeClasses: Record<Size, string> = {
  md: "h-11 px-4 text-sm",
  lg: "h-[52px] px-5 text-[15px]",
};

function buttonClassName(
  variant: Variant,
  size: Size,
  fullWidth: boolean | undefined,
  className: string
) {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth, loading, icon, disabled, className = "", children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClassName(variant, size, fullWidth, className)}
      {...props}
    >
      {loading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : icon}
      {children}
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
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClassName(variant, size, fullWidth, className)}>
      {icon}
      {children}
    </Link>
  );
}
