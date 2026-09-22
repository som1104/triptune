import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Container } from "@/components/layout/container";
import { activeReopening, REOPEN_DETAIL, REOPEN_HEADLINE, reopenTarget } from "@/lib/trip/reopen";
import type { Participant, Trip } from "@/lib/supabase/database.types";

/* 재조율이 열려 있는 동안 모든 탭 위에 붙는 안내. 레이아웃에 있어서 탭을
   옮겨도 유지되고, 재개 전에 열어둔 화면도 Realtime 새로고침과 함께 갱신되어
   오래된 '확정' 화면이 남지 않는다. */
export function ReopenNotice({
  trip,
  participants,
}: {
  trip: Trip;
  participants: Participant[];
}) {
  const reopening = activeReopening(trip);
  if (!reopening) return null;

  const by = participants.find((p) => p.id === reopening.byParticipantId);
  const target = reopenTarget(reopening.scope, trip.id);

  return (
    <div className="border-b border-hairline-soft bg-primary-soft">
      <Container className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="mt-0.5 flex shrink-0 text-primary">
            <RotateCcw size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[15px] font-semibold text-ink">
              {REOPEN_HEADLINE[reopening.scope]}
            </p>
            {reopening.reason && (
              <p className="m-0 mt-0.5 text-sm leading-[1.45] text-ink">
                “{reopening.reason}”
                {by && <span className="text-text-muted"> — {by.nickname}</span>}
              </p>
            )}
            <p className="m-0 mt-0.5 text-[13px] leading-[1.45] text-ink-soft">
              {REOPEN_DETAIL[reopening.scope]}
            </p>
          </div>
        </div>
        <Link
          href={target.href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-on-primary"
        >
          {target.label}
        </Link>
      </Container>
    </div>
  );
}
