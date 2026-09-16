const PALETTE = ["var(--avatar-1)", "var(--avatar-2)", "var(--avatar-3)", "var(--avatar-4)"];

export function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

const sizeClasses = {
  sm: "h-6 w-6 text-[11px]",
  md: "h-9 w-9 text-[13px]",
  lg: "h-10 w-10 text-[15px]",
} as const;

export function Avatar({
  nickname,
  seed,
  size = "md",
  ringed,
}: {
  nickname: string;
  seed?: string;
  size?: keyof typeof sizeClasses;
  ringed?: boolean;
}) {
  const initial = [...nickname.trim()][0]?.toUpperCase() ?? "?";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${sizeClasses[size]} ${ringed ? "border-2 border-surface" : ""}`}
      style={{ background: avatarColor(seed ?? nickname) }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
