"use client";

import { useId, useState } from "react";
import { ExternalLink, MoreHorizontal, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { StayImage } from "@/components/ui/stay-image";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { formatPrice, perPersonPrice } from "@/lib/trip/format";
import { bookingLine, parseRooms, roomsSummaryLine } from "@/lib/trip/stay";
import { RoomsDisclosure } from "@/components/trip/stay-room-details";
import type { Accommodation } from "@/lib/supabase/database.types";

export function AccommodationCard({
  accommodation,
  creatorId,
  creatorNickname,
  confirmedParticipantCount,
  nights,
  canManage,
  onEdit,
  onDelete,
}: {
  accommodation: Accommodation;
  creatorId: string;
  creatorNickname: string;
  confirmedParticipantCount: number | null;
  nights: number;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const perPerson = confirmedParticipantCount
    ? perPersonPrice(accommodation.total_price, confirmedParticipantCount)
    : null;
  const underCapacity =
    confirmedParticipantCount != null && accommodation.capacity < confirmedParticipantCount;
  const isRooms = accommodation.booking_mode === "rooms";
  const roomsLine = isRooms ? roomsSummaryLine(parseRooms(accommodation.rooms)) : "";

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface">
      <div className="h-40 w-full desk:h-[200px]">
        <StayImage src={accommodation.image_url} alt={accommodation.name} />
      </div>
      <div className="flex flex-col gap-3 p-4 desk:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="m-0 min-w-0 flex-1 break-words text-[18px] font-[650] text-ink">
            {accommodation.name}
          </p>
          {canManage && (
            <div className="relative -mr-2.5 -mt-2.5 shrink-0">
              <button
                type="button"
                aria-label="숙소 후보 메뉴"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-text-muted hover:bg-primary-soft"
              >
                <MoreHorizontal size={18} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div
                  id={menuId}
                  role="menu"
                  className="absolute right-0 top-11 z-10 w-36 overflow-hidden rounded-2xl border border-hairline bg-surface"
                >
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit();
                    }}
                    className="flex min-h-11 w-full items-center gap-2 px-4 text-sm text-ink hover:bg-primary-soft"
                  >
                    <Pencil size={15} aria-hidden="true" /> 수정
                  </button>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="flex min-h-11 w-full items-center gap-2 px-4 text-sm text-conflict-text hover:bg-conflict-bg"
                  >
                    <Trash2 size={15} aria-hidden="true" /> 삭제
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 예약안이 한눈에 읽히도록 이용 방식 → 금액 → 위치 순으로. */}
        <div>
          {roomsLine && <p className="m-0 text-sm text-ink-soft">{roomsLine}</p>}
          <p className="m-0 text-sm font-semibold text-ink">{bookingLine(accommodation)}</p>
        </div>

        <div>
          <p className="m-0 text-[18px] font-[650] text-ink">
            총 {formatPrice(accommodation.total_price)}
            {perPerson != null && <> · 1인 약 {formatPrice(perPerson)}</>}
          </p>
          <p className="m-0 mt-0.5 text-sm text-ink-soft">
            {nights}박
            {confirmedParticipantCount != null && <> · 확정 인원 {confirmedParticipantCount}명 기준</>}
          </p>
        </div>

        <p className="m-0 text-sm text-ink-soft">{accommodation.location}</p>

        <RoomsDisclosure accommodation={accommodation} className="-ml-4" />

        {underCapacity && (
          <p className="m-0 flex items-center gap-1.5 text-xs font-medium text-conflict-text">
            <TriangleAlert size={13} aria-hidden="true" /> 현재 참여 인원보다 수용 가능 인원이 적어요.
          </p>
        )}
        {accommodation.note && <p className="m-0 text-sm text-ink-soft">{accommodation.note}</p>}

        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-[13px] text-text-muted">
            <Avatar nickname={creatorNickname} seed={creatorId} size="xs" />
            {creatorNickname}님이 추가
          </span>
          <LinkButton
            href={accommodation.url}
            external
            variant="outline"
            className="shrink-0"
            icon={<ExternalLink size={16} aria-hidden="true" />}
          >
            숙소 페이지
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
