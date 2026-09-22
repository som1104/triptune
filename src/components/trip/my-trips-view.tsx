"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass, Plus } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import { Container, PageBody } from "@/components/layout/container";
import { TripListCard } from "@/components/trip/trip-list-card";
import { TripTopNav } from "@/components/layout/trip-top-nav";
import { ProfileMenu, GuestChip } from "@/components/auth/profile-menu";
import { useAccountSheet } from "@/components/auth/account-sheet";
import { useToast } from "@/components/ui/toast";
import type { MyTrip } from "@/lib/trip/my-trips";

const RECENT_CONFIRMED = 3;

/* 1 / 2 / 3 columns. A single card keeps one column's width rather than
   stretching — that is what `grid` gives us for free, and what the board
   calls out explicitly. */
const GRID = "grid gap-4 md:grid-cols-2 md:gap-6 desk:grid-cols-3";

export function MyTripsView({ trips }: { trips: MyTrip[] }) {
  /* 서버에서 받은 목록을 그대로 쓰되, 방금 지운 여행은 서버 응답을 기다리지
     않고 바로 빼준다. 실패하면 되돌린다. */
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const router = useRouter();
  const params = useSearchParams();
  const { openAccountSheet } = useAccountSheet();
  const { showToast } = useToast();
  const [showAllConfirmed, setShowAllConfirmed] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<MyTrip | null>(null);
  const [removing, setRemoving] = useState(false);

  const saved = params.get("saved");
  useEffect(() => {
    if (!saved) return;
    showToast("여행을 계정에 저장했어요. 이제 다른 기기에서도 확인할 수 있어요.");
    router.replace("/");
  }, [saved, showToast, router]);

  const visible = trips.filter((t) => !removedIds.includes(t.trip.id));
  const ongoing = visible.filter((t) => t.trip.status !== "confirmed");
  const confirmed = visible.filter((t) => t.trip.status === "confirmed");
  const visibleConfirmed = showAllConfirmed ? confirmed : confirmed.slice(0, RECENT_CONFIRMED);
  const isEmpty = visible.length === 0;

  /* 주최자가 지우면 여행 자체가 사라지고, 참여자가 지우면 본인만 빠져요 —
     같은 ⋯ 메뉴지만 부르는 함수도 확인 문구도 다릅니다. */
  async function confirmRemove() {
    if (!removeTarget) return;
    const { trip, isHost } = removeTarget;
    setRemoving(true);
    // 카드를 먼저 치우고 모달을 닫는다 — 되돌릴 수 있게 id 를 기억해 둔다.
    setRemovedIds((prev) => [...prev, trip.id]);
    setRemoveTarget(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc(isHost ? "delete_trip" : "leave_trip", {
        p_trip_id: trip.id,
      });
      if (error) throw new Error(error.message);
      showToast(isHost ? "여행을 삭제했어요." : "여행에서 나왔어요.");
      // 서버 목록도 맞춰두되, 화면은 이미 반영돼 있으므로 기다리지 않는다.
      router.refresh();
    } catch (err) {
      setRemovedIds((prev) => prev.filter((id) => id !== trip.id));
      showToast(
        err instanceof Error ? err.message : "지우지 못했어요. 잠시 후 다시 시도해 주세요.",
        "error"
      );
    } finally {
      setRemoving(false);
    }
  }

  const newTripButton = (
    <LinkButton href="/new" icon={<Plus size={16} aria-hidden="true" />} iconPosition="start">
      새 여행 만들기
    </LinkButton>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <TripTopNav />

      {/* mobile/tablet header — the desktop equivalent lives in TripTopNav */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 bg-surface pl-5 pr-2 desk:hidden">
        <h1 className="m-0 text-base font-semibold leading-[1.3] text-ink">내 여행</h1>
        <div className="flex items-center gap-2">
          <GuestChip />
          <ProfileMenu />
        </div>
      </header>

      {isEmpty ? (
        <Container className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-primary-soft text-primary">
            <Compass size={36} aria-hidden="true" />
          </span>
          <p className="m-0 mt-2 text-base font-semibold text-ink">아직 참여 중인 여행이 없어요.</p>
          <p className="m-0 text-[13px] text-text-muted">친구들과 새로운 여행을 시작해보세요.</p>

          <div className="mt-4 w-full max-w-[320px]">
            <LinkButton
              href="/new"
              size="lg"
              fullWidth
              icon={<Plus size={16} aria-hidden="true" />}
              iconPosition="start"
            >
              새 여행 만들기
            </LinkButton>
          </div>

          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="m-0 text-[13px] text-text-muted">계정에 저장한 여행이 있나요?</p>
            <Button variant="outline" onClick={openAccountSheet}>
              로그인해서 불러오기
            </Button>
          </div>
        </Container>
      ) : (
        <PageBody className="gap-8">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0">
              <h2 className="m-0 mb-1.5 hidden text-2xl font-[650] leading-[1.2] text-ink desk:block desk:text-[28px]">
                내 여행
              </h2>
              <p className="m-0 text-[15px] text-text-muted">
                진행 중인 여행 {ongoing.length}개 · 확정된 여행 {confirmed.length}개
              </p>
            </div>
            <div className="hidden shrink-0 md:block">{newTripButton}</div>
          </div>

          <section className="flex flex-col gap-4">
            <p className="m-0 text-base font-semibold text-ink">진행 중인 여행</p>
            {ongoing.length === 0 ? (
              <div className="rounded-2xl border border-hairline-soft px-4 py-3">
                <p className="m-0 text-[13px] text-text-muted">진행 중인 여행이 없어요.</p>
              </div>
            ) : (
              <div className={GRID}>
                {ongoing.map((item) => (
                  <TripListCard key={item.trip.id} item={item} onRemove={setRemoveTarget} />
                ))}
              </div>
            )}
          </section>

          {confirmed.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="m-0 text-base font-semibold text-ink">확정된 여행</p>
                {confirmed.length > RECENT_CONFIRMED && (
                  <button
                    type="button"
                    onClick={() => setShowAllConfirmed((v) => !v)}
                    className="min-h-11 text-sm font-semibold text-ink"
                  >
                    {showAllConfirmed ? "접기" : "전체 보기"}
                  </button>
                )}
              </div>
              <div className={GRID}>
                {visibleConfirmed.map((item) => (
                  <TripListCard key={item.trip.id} item={item} onRemove={setRemoveTarget} />
                ))}
              </div>
            </section>
          )}

          <div className="mt-auto pt-2 md:hidden">
            <LinkButton
              href="/new"
              variant="soft"
              size="lg"
              fullWidth
              icon={<Plus size={16} aria-hidden="true" />}
              iconPosition="start"
            >
              새 여행 만들기
            </LinkButton>
          </div>
        </PageBody>
      )}

      <Modal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget?.isHost ? "이 여행을 삭제할까요?" : "이 여행에서 나갈까요?"}
        description={
          removeTarget
            ? removeTarget.isHost
              ? `"${removeTarget.trip.title}"이(가) 참여자 모두에게서 사라져요. 응답과 숙소 후보, 투표 기록도 함께 지워지고 되돌릴 수 없어요.`
              : `"${removeTarget.trip.title}"이(가) 내 목록에서 빠져요. 내가 남긴 응답과 등록한 숙소 후보도 함께 지워져요. 초대 링크가 살아 있으면 다시 참여할 수 있어요.`
            : undefined
        }
      >
        <div className="flex flex-col gap-2">
          <Button variant="outline" fullWidth onClick={() => setRemoveTarget(null)}>
            취소
          </Button>
          <Button fullWidth loading={removing} onClick={confirmRemove}>
            {removeTarget?.isHost ? "삭제" : "나가기"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
