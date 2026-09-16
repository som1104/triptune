"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Vote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TripAppBar } from "@/components/layout/trip-app-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { AccommodationCard } from "@/components/trip/accommodation-card";
import { AddAccommodationSheet } from "@/components/trip/add-accommodation-sheet";
import type { Accommodation, Participant } from "@/lib/supabase/database.types";

const TOTAL_LIMIT = 5;
const PER_PARTICIPANT_LIMIT = 2;

export function StayCollectingView({
  tripId,
  myParticipantId,
  isHost,
  participants,
  initialAccommodations,
  confirmedParticipantCount,
}: {
  tripId: string;
  myParticipantId: string;
  isHost: boolean;
  participants: Participant[];
  initialAccommodations: Accommodation[];
  confirmedParticipantCount: number | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [accommodations, setAccommodations] = useState(initialAccommodations);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Accommodation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Accommodation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showStartVoting, setShowStartVoting] = useState(false);
  const [startingVote, setStartingVote] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`accommodations-${tripId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "accommodations", filter: `trip_id=eq.${tripId}` },
          (payload) => {
            setAccommodations((prev) => {
              if (payload.eventType === "INSERT") {
                const next = payload.new as Accommodation;
                if (prev.some((a) => a.id === next.id)) return prev;
                return [...prev, next].sort((a, b) => a.created_at.localeCompare(b.created_at));
              }
              if (payload.eventType === "UPDATE") {
                const next = payload.new as Accommodation;
                return prev.map((a) => (a.id === next.id ? next : a));
              }
              if (payload.eventType === "DELETE") {
                const old = payload.old as Partial<Accommodation>;
                return prev.filter((a) => a.id !== old.id);
              }
              return prev;
            });
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [tripId]);

  const nicknameById = new Map(participants.map((p) => [p.id, p.nickname]));
  const myCount = accommodations.filter((a) => a.created_by_participant_id === myParticipantId).length;
  const canAddMore = accommodations.length < TOTAL_LIMIT && myCount < PER_PARTICIPANT_LIMIT;
  const canStartVoting =
    isHost &&
    accommodations.length >= 2 &&
    accommodations.length <= TOTAL_LIMIT &&
    (confirmedParticipantCount ?? 0) >= 2;

  async function startVoting() {
    setStartingVote(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("start_voting", { p_trip_id: tripId });
      if (error) throw new Error(error.message);
      setShowStartVoting(false);
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "투표를 시작하지 못했어요.", "error");
    } finally {
      setStartingVote(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("accommodations").delete().eq("id", deleteTarget.id);
      if (error) throw new Error(error.message);
      setAccommodations((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      showToast("숙소 후보를 삭제했어요.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "삭제하지 못했어요.", "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <TripAppBar title="숙소 정하기" />
      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="m-0 mb-1 text-xl font-bold text-ink">숙소 후보 모으는 중</h2>
            <p className="m-0 text-sm text-text-muted">
              {accommodations.length === 0
                ? "아직 등록된 숙소가 없어요."
                : `현재 ${accommodations.length}개의 숙소가 등록되었어요.`}
            </p>
          </div>
          <Badge variant="primary">{accommodations.length} / {TOTAL_LIMIT}</Badge>
        </div>

        <div className="flex flex-col gap-3">
          {accommodations.map((a) => (
            <AccommodationCard
              key={a.id}
              accommodation={a}
              creatorNickname={nicknameById.get(a.created_by_participant_id) ?? "알 수 없음"}
              confirmedParticipantCount={confirmedParticipantCount}
              canManage={isHost || a.created_by_participant_id === myParticipantId}
              onEdit={() => {
                setEditing(a);
                setSheetOpen(true);
              }}
              onDelete={() => setDeleteTarget(a)}
            />
          ))}
        </div>

        {accommodations.length < 2 && (
          <p className="text-xs text-text-muted">후보가 2개 이상이면 투표를 시작할 수 있어요.</p>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Button
            variant={canAddMore ? "primary" : "soft"}
            size="lg"
            fullWidth
            disabled={!canAddMore}
            icon={<Plus size={18} aria-hidden="true" />}
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            숙소 후보 추가
          </Button>
          {!canAddMore && (
            <p className="text-center text-xs text-text-muted">
              {myCount >= PER_PARTICIPANT_LIMIT
                ? "1인당 최대 2개까지 등록할 수 있어요."
                : "숙소 후보는 최대 5개까지 등록할 수 있어요."}
            </p>
          )}
          {isHost && (
            <Button
              variant="outline"
              size="lg"
              fullWidth
              disabled={!canStartVoting}
              icon={<Vote size={18} aria-hidden="true" />}
              onClick={() => setShowStartVoting(true)}
            >
              숙소 투표 시작하기
            </Button>
          )}
        </div>
      </div>

      <AddAccommodationSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        tripId={tripId}
        participantId={myParticipantId}
        editing={editing}
        onSaved={(saved) =>
          setAccommodations((prev) =>
            prev.some((a) => a.id === saved.id)
              ? prev.map((a) => (a.id === saved.id ? saved : a))
              : [...prev, saved].sort((a, b) => a.created_at.localeCompare(b.created_at))
          )
        }
      />

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="이 숙소 후보를 삭제할까요?"
        description={deleteTarget ? `"${deleteTarget.name}"이(가) 목록에서 사라져요.` : undefined}
      >
        <div className="flex flex-col gap-2">
          <Button variant="outline" fullWidth onClick={() => setDeleteTarget(null)}>
            취소
          </Button>
          <Button fullWidth loading={deleting} onClick={handleDelete}>
            삭제
          </Button>
        </div>
      </Modal>

      <Modal
        open={showStartVoting}
        onClose={() => setShowStartVoting(false)}
        title="투표를 시작할까요?"
        description="투표를 시작하면 숙소 후보를 추가하거나 삭제할 수 없어요."
      >
        <div className="flex flex-col gap-2">
          <Button variant="outline" fullWidth onClick={() => setShowStartVoting(false)}>
            취소
          </Button>
          <Button fullWidth loading={startingVote} onClick={startVoting}>
            투표 시작
          </Button>
        </div>
      </Modal>
    </div>
  );
}
