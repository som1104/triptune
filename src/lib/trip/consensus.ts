import type { DateAvailability, SpendingStyle, TravelPace } from "@/lib/supabase/database.types";

// ============================================================
// Shared input shapes (deliberately decoupled from DB row shapes so
// these functions stay pure and easy to unit test).
// ============================================================

export interface DateResponseInput {
  participantId: string;
  date: string; // ISO yyyy-mm-dd
  availability: DateAvailability;
}

export interface PreferenceResponseInput {
  participantId: string;
  nature: number;
  food: number;
  cafe: number;
  activity: number;
  pace: TravelPace;
  spendingStyle: SpendingStyle;
}

// ============================================================
// Date helpers (UTC epoch-day based to stay deterministic
// regardless of the host's local timezone).
// ============================================================

function toEpochDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function fromEpochDay(day: number): string {
  const d = new Date(day * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ============================================================
// Date consensus (spec section 10)
// ============================================================

export type WindowParticipantStatus = "full" | "tentative" | "unavailable";

export interface DateWindowCandidate {
  startDate: string;
  endDate: string;
  fullyAvailableCount: number;
  tentativeOnlyCount: number;
  unavailableCount: number;
  tentativeDayInstances: number;
  totalScore: number;
  label: "합의 후보" | "조율 필요";
}

const DAY_SCORE: Record<DateAvailability, number> = {
  available: 2,
  tentative: 1,
  unavailable: 0,
};

/** Participants whose response_status is "submitted" are the only ones counted here. */
export function computeDateCandidates(
  candidateStartDate: string,
  candidateEndDate: string,
  tripDays: number,
  respondedParticipantIds: string[],
  dateResponses: DateResponseInput[]
): DateWindowCandidate[] {
  const start = toEpochDay(candidateStartDate);
  const end = toEpochDay(candidateEndDate);
  const spanDays = end - start + 1;
  if (tripDays > spanDays || tripDays < 1) return [];

  // participantId -> date -> availability. A date with no row is treated as
  // unavailable for scoring purposes (a candidate window shouldn't be
  // presented as viable on the strength of days nobody confirmed).
  const byParticipant = new Map<string, Map<string, DateAvailability>>();
  for (const id of respondedParticipantIds) byParticipant.set(id, new Map());
  for (const r of dateResponses) {
    const m = byParticipant.get(r.participantId);
    if (m) m.set(r.date, r.availability);
  }

  const candidates: DateWindowCandidate[] = [];

  for (let windowStart = start; windowStart + tripDays - 1 <= end; windowStart++) {
    const windowEnd = windowStart + tripDays - 1;
    const windowDates: string[] = [];
    for (let d = windowStart; d <= windowEnd; d++) windowDates.push(fromEpochDay(d));

    let fullyAvailableCount = 0;
    let tentativeOnlyCount = 0;
    let unavailableCount = 0;
    let tentativeDayInstances = 0;
    let totalScore = 0;

    for (const participantId of respondedParticipantIds) {
      const dates = byParticipant.get(participantId)!;
      let status: WindowParticipantStatus = "full";
      for (const date of windowDates) {
        const availability = dates.get(date) ?? "unavailable";
        totalScore += DAY_SCORE[availability];
        if (availability === "unavailable") {
          status = "unavailable";
        } else if (availability === "tentative") {
          tentativeDayInstances++;
          if (status !== "unavailable") status = "tentative";
        }
      }
      if (status === "full") fullyAvailableCount++;
      else if (status === "tentative") tentativeOnlyCount++;
      else unavailableCount++;
    }

    candidates.push({
      startDate: fromEpochDay(windowStart),
      endDate: fromEpochDay(windowEnd),
      fullyAvailableCount,
      tentativeOnlyCount,
      unavailableCount,
      tentativeDayInstances,
      totalScore,
      label: unavailableCount === 0 ? "합의 후보" : "조율 필요",
    });
  }

  candidates.sort((a, b) => {
    if (a.fullyAvailableCount !== b.fullyAvailableCount) return b.fullyAvailableCount - a.fullyAvailableCount;
    if (a.unavailableCount !== b.unavailableCount) return a.unavailableCount - b.unavailableCount;
    if (a.tentativeDayInstances !== b.tentativeDayInstances) return a.tentativeDayInstances - b.tentativeDayInstances;
    if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore;
    return a.startDate.localeCompare(b.startDate);
  });

  return candidates;
}

export function topDateCandidates(candidates: DateWindowCandidate[], count = 3): DateWindowCandidate[] {
  return candidates.slice(0, count);
}

// ============================================================
// Preference consensus (spec section 11)
// ============================================================

export type PreferenceKey = "nature" | "food" | "cafe" | "activity";
export type PreferenceClassification = "favored" | "disfavored" | "conflict" | "neutral";

export interface PreferenceItemResult {
  key: PreferenceKey;
  average: number;
  classification: PreferenceClassification;
  counts: Record<-2 | -1 | 0 | 1 | 2, number>;
  responseCount: number;
}

const PREFERENCE_KEYS: PreferenceKey[] = ["nature", "food", "cafe", "activity"];

export function computePreferenceConsensus(
  responses: PreferenceResponseInput[]
): Record<PreferenceKey, PreferenceItemResult> {
  const result = {} as Record<PreferenceKey, PreferenceItemResult>;

  for (const key of PREFERENCE_KEYS) {
    const scores = responses.map((r) => r[key]);
    const n = scores.length;
    const counts: Record<-2 | -1 | 0 | 1 | 2, number> = { [-2]: 0, [-1]: 0, 0: 0, 1: 0, 2: 0 };
    for (const s of scores) counts[s as -2 | -1 | 0 | 1 | 2]++;

    const average = n === 0 ? 0 : scores.reduce((a, b) => a + b, 0) / n;
    const max = n === 0 ? 0 : Math.max(...scores);
    const min = n === 0 ? 0 : Math.min(...scores);
    const positiveRatio = n === 0 ? 0 : (counts[1] + counts[2]) / n;
    const negativeRatio = n === 0 ? 0 : (counts[-1] + counts[-2]) / n;

    const hasConflict =
      n > 0 &&
      (max - min >= 3 ||
        (scores.some((s) => s > 0) && scores.some((s) => s < 0)) ||
        (counts[2] > 0 && counts[-2] > 0));

    let classification: PreferenceClassification;
    if (n === 0) classification = "neutral";
    else if (hasConflict) classification = "conflict";
    else if (average >= 0.75 && positiveRatio >= 0.7) classification = "favored";
    else if (average <= -0.75 && negativeRatio >= 0.7) classification = "disfavored";
    else classification = "neutral";

    result[key] = { key, average, classification, counts, responseCount: n };
  }

  return result;
}

// ============================================================
// Travel style consensus (pace / spending style — majority or split)
// ============================================================

export interface StyleConsensusResult<T extends string> {
  mode: T | null; // null when tied for the top spot
  counts: Partial<Record<T, number>>;
  isSplit: boolean;
}

export function computeStyleConsensus<T extends string>(values: T[]): StyleConsensusResult<T> {
  const counts: Partial<Record<T, number>> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;

  const entries = Object.entries(counts) as [T, number][];
  if (entries.length === 0) return { mode: null, counts, isSplit: false };

  const max = Math.max(...entries.map(([, c]) => c));
  const topKeys = entries.filter(([, c]) => c === max).map(([k]) => k);

  return topKeys.length === 1
    ? { mode: topKeys[0], counts, isSplit: false }
    : { mode: null, counts, isSplit: true };
}

// ============================================================
// One-line group summary (spec section 12)
// ============================================================

const PREFERENCE_LABEL: Record<PreferenceKey, string> = {
  nature: "자연",
  food: "맛집",
  cafe: "카페",
  activity: "활동",
};
// Korean particle grammar for the 4 fixed preference labels.
const JOIN_PARTICLE: Record<PreferenceKey, string> = { nature: "과", food: "과", cafe: "와", activity: "과" };
const OBJECT_PARTICLE: Record<PreferenceKey, string> = { nature: "을", food: "을", cafe: "를", activity: "을" };

const PACE_LABEL: Record<TravelPace, string> = {
  relaxed: "여유롭게",
  balanced: "적당히",
  packed: "알차게",
};

export function buildGroupSummary(
  preferenceResults: Record<PreferenceKey, PreferenceItemResult>,
  paceConsensus: StyleConsensusResult<TravelPace>
): string {
  const strongPrefs = PREFERENCE_KEYS.map((key) => preferenceResults[key])
    .filter((r) => r.classification === "favored")
    .sort((a, b) => b.average - a.average)
    .slice(0, 2);

  if (strongPrefs.length === 0) {
    return "다양한 취향을 조율하고 있어요.";
  }

  let prefix: string;
  if (strongPrefs.length === 1) {
    const [a] = strongPrefs;
    prefix = `${PREFERENCE_LABEL[a.key]}${OBJECT_PARTICLE[a.key]} 중심으로, `;
  } else {
    const [a, b] = strongPrefs;
    prefix = `${PREFERENCE_LABEL[a.key]}${JOIN_PARTICLE[a.key]} ${PREFERENCE_LABEL[b.key]}${OBJECT_PARTICLE[b.key]} 중심으로, `;
  }

  const suffix = paceConsensus.mode
    ? `${PACE_LABEL[paceConsensus.mode]} 즐기는 여행이에요.`
    : "즐기는 여행이에요.";

  return prefix + suffix;
}
