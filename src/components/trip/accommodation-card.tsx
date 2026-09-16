"use client";

import { useId, useState } from "react";
import { ExternalLink, MoreVertical, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { StayImage } from "@/components/ui/stay-image";
import { Badge } from "@/components/ui/badge";
import { formatPrice, perPersonPrice } from "@/lib/trip/format";
import type { Accommodation } from "@/lib/supabase/database.types";

export function AccommodationCard({
  accommodation,
  creatorNickname,
  confirmedParticipantCount,
  canManage,
  onEdit,
  onDelete,
}: {
  accommodation: Accommodation;
  creatorNickname: string;
  confirmedParticipantCount: number | null;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const perPerson = confirmedParticipantCount
    ? perPersonPrice(accommodation.total_price, confirmedParticipantCount)
    : null;
  const underCapacity = confirmedParticipantCount != null && accommodation.capacity < confirmedParticipantCount;

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface">
      <div className="h-36 w-full">
        <StayImage src={accommodation.image_url} alt={accommodation.name} />
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[16px] font-semibold text-ink">{accommodation.name}</p>
          {canManage && (
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label="숙소 후보 메뉴"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-primary-soft"
              >
                <MoreVertical size={18} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div
                  id={menuId}
                  role="menu"
                  className="absolute right-0 top-11 z-10 w-36 overflow-hidden rounded-xl border border-hairline-soft bg-surface shadow-lg"
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

        <p className="text-sm text-ink-soft">
          총 {formatPrice(accommodation.total_price)}
          {perPerson != null && <> · 1인 약 {formatPrice(perPerson)}</>}
        </p>
        <p className="text-sm text-text-muted">
          {accommodation.location} · 최대 {accommodation.capacity}명
        </p>
        {underCapacity && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-conflict-text">
            <TriangleAlert size={13} aria-hidden="true" /> 현재 참여 인원보다 수용 가능 인원이 적어요.
          </p>
        )}
        {accommodation.note && <p className="text-sm text-ink-soft">{accommodation.note}</p>}

        <div className="mt-1 flex items-center justify-between gap-2">
          <Badge variant="muted">{creatorNickname} 등록</Badge>
          <a
            href={accommodation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-hairline px-3 text-sm font-semibold text-ink-soft hover:bg-primary-soft"
          >
            숙소 페이지 <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
