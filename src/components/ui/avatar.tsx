"use client";

import { createContext, useContext, useMemo } from "react";

/* One colour per seat. A trip caps at 10 people, so ten entries mean nobody
   inside a trip ever shares a colour — the seat index, not a hash of the id,
   decides. The order alternates hue so neighbours in a roster stay apart. */
const PALETTE = [
  "var(--avatar-1)",
  "var(--avatar-2)",
  "var(--avatar-3)",
  "var(--avatar-4)",
  "var(--avatar-5)",
  "var(--avatar-6)",
  "var(--avatar-7)",
  "var(--avatar-8)",
  "var(--avatar-9)",
  "var(--avatar-10)",
];

export const AVATAR_COLOR_COUNT = PALETTE.length;

export function avatarColorAt(index: number) {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}

/** Fallback for avatars drawn outside a trip, where there is no seat order. */
export function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/* Seat numbers for one trip, keyed by participant id. Screens deep inside a
   trip (a stay card, the vote roster) only know an id, so the order is
   published once by the trip layout instead of threaded through every prop. */
const SeatContext = createContext<Record<string, number> | null>(null);

export function ParticipantColors({
  participants,
  children,
}: {
  /** in join order — that order IS the seat order */
  participants: { id: string }[];
  children: React.ReactNode;
}) {
  const seats = useMemo(() => {
    const map: Record<string, number> = {};
    participants.forEach((p, i) => {
      map[p.id] = i;
    });
    return map;
  }, [participants]);

  return <SeatContext.Provider value={seats}>{children}</SeatContext.Provider>;
}

function useSeatColor(seed: string | undefined, colorIndex: number | undefined) {
  const seats = useContext(SeatContext);
  if (colorIndex != null) return avatarColorAt(colorIndex);
  if (seed && seats && seats[seed] != null) return avatarColorAt(seats[seed]);
  return null;
}

/* Design sizes: 24 in dense rows, 28 in the invite stack, 32 in the vote
   stack, 36 as the standard list avatar. Type stays 12–13/600 throughout. */
const sizeClasses = {
  xs: "h-6 w-6 text-xs",
  sm: "h-7 w-7 text-xs",
  md: "h-8 w-8 text-xs",
  lg: "h-9 w-9 text-[13px]",
} as const;

export function Avatar({
  nickname,
  seed,
  colorIndex,
  size = "lg",
  ringed,
}: {
  nickname: string;
  seed?: string;
  /** seat number, when the caller already knows it (a list it is rendering) */
  colorIndex?: number;
  size?: keyof typeof sizeClasses;
  ringed?: boolean;
}) {
  const initial = [...nickname.trim()][0]?.toUpperCase() ?? "?";
  const seatColor = useSeatColor(seed, colorIndex);
  const background = seatColor ?? avatarColor(seed ?? nickname);

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${sizeClasses[size]} ${ringed ? "border-2 border-surface" : ""}`}
      style={{ background }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

/* Overlapping row of avatars — each ringed in the surface colour so the
   stack reads as one group, exactly as on screens 03 and 06-D. */
export function AvatarStack({
  people,
  size = "md",
  emptySlots = 0,
}: {
  /** in join order, so position doubles as the seat number */
  people: { id: string; nickname: string }[];
  size?: keyof typeof sizeClasses;
  emptySlots?: number;
}) {
  return (
    <span className="flex">
      {people.map((p, i) => (
        <span key={p.id} className={i > 0 ? "-ml-2" : ""}>
          <Avatar nickname={p.nickname} seed={p.id} colorIndex={i} size={size} ringed />
        </span>
      ))}
      {Array.from({ length: emptySlots }).map((_, i) => (
        <span
          key={`empty-${i}`}
          className={`flex items-center justify-center rounded-full border-2 border-dashed border-text-faint bg-surface font-semibold text-text-faint ${sizeClasses[size]} ${people.length + i > 0 ? "-ml-2" : ""}`}
          aria-hidden="true"
        >
          {people.length + i + 1}
        </span>
      ))}
    </span>
  );
}
