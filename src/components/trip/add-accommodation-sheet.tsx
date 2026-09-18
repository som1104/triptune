"use client";

import { useEffect, useId, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus, Search, Trash2, TriangleAlert } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TextInput } from "@/components/ui/text-input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { accommodationSchema, type AccommodationInput } from "@/lib/validation/accommodation";
import { formatPrice, formatTripLength, perPersonPrice } from "@/lib/trip/format";
import { parseRooms, roomTotals } from "@/lib/trip/stay";
import type { Accommodation, StayBookingMode } from "@/lib/supabase/database.types";

const ERROR_MESSAGES: Record<string, string> = {
  ACCOMMODATION_LIMIT_TOTAL: "숙소 후보는 최대 5개까지 등록할 수 있어요.",
  ACCOMMODATION_LIMIT_PER_PARTICIPANT: "1인당 최대 2개까지 등록할 수 있어요.",
  accommodations_rooms_shape: "객실 구성을 다시 확인해주세요.",
};

const MODE_OPTIONS: { value: StayBookingMode; label: string }[] = [
  { value: "whole", label: "숙소 전체 사용" },
  { value: "rooms", label: "객실 여러 개" },
];

const EMPTY_ROOM = { name: "", count: 1, capacityPerRoom: 2, pricePerRoom: 0 };

/* 이용 방식을 고르기 전에는 아무것도 선택되지 않은 상태로 둔다 — zod 가
   빈 값을 잡아내므로 타입만 맞춰준다. */
const NO_MODE = "" as AccommodationInput["bookingMode"];

export function AddAccommodationSheet({
  open,
  onClose,
  tripId,
  participantId,
  confirmedParticipantCount,
  tripDays,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  participantId: string;
  /** 1인 금액과 수용 인원 검증의 기준 */
  confirmedParticipantCount: number | null;
  tripDays: number;
  editing: Accommodation | null;
  onSaved: (saved: Accommodation) => void;
}) {
  const { showToast } = useToast();
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [pendingMode, setPendingMode] = useState<StayBookingMode | null>(null);
  const formId = useId();
  const noteId = useId();

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccommodationInput>({
    resolver: zodResolver(accommodationSchema),
    values: editing
      ? {
          url: editing.url,
          name: editing.name,
          imageUrl: editing.image_url ?? "",
          location: editing.location,
          bookingMode: editing.booking_mode,
          totalPrice: editing.booking_mode === "whole" ? editing.total_price : 0,
          capacity: editing.booking_mode === "whole" ? editing.capacity : 0,
          rooms: editing.booking_mode === "rooms" ? parseRooms(editing.rooms) : [],
          note: editing.note ?? "",
        }
      : {
          url: "",
          name: "",
          imageUrl: "",
          location: "",
          bookingMode: NO_MODE,
          totalPrice: 0,
          capacity: 0,
          rooms: [],
          note: "",
        },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "rooms" });
  const [bookingMode, watchedRooms, watchedCapacity, watchedTotalPrice] = useWatch({
    control,
    name: ["bookingMode", "rooms", "capacity", "totalPrice"],
  });

  // 객실 모드로 들어왔는데 비어 있으면 첫 줄은 만들어 둔다.
  useEffect(() => {
    if (bookingMode === "rooms" && fields.length === 0) append({ ...EMPTY_ROOM });
  }, [bookingMode, fields.length, append]);

  const rooms = parseRooms(watchedRooms);
  const totals = roomTotals(rooms);
  const isRooms = bookingMode === "rooms";
  const capacity = isRooms ? totals.capacity : Number(watchedCapacity) || 0;
  const totalPrice = isRooms ? totals.totalPrice : Number(watchedTotalPrice) || 0;
  const perPerson =
    confirmedParticipantCount && totalPrice > 0
      ? perPersonPrice(totalPrice, confirmedParticipantCount)
      : null;
  const shortBy = confirmedParticipantCount ? Math.max(confirmedParticipantCount - capacity, 0) : 0;
  const capacityOk = shortBy === 0 && capacity > 0;

  function requestMode(next: StayBookingMode) {
    if (next === bookingMode) return;
    // 방식이 바뀌면 남은 입력은 서로 뜻이 달라진다. 섞지 않고 확인 후 버린다.
    const hasInput = bookingMode === "rooms" ? rooms.length > 0 : capacity > 0 || totalPrice > 0;
    if (bookingMode && hasInput) {
      setPendingMode(next);
      return;
    }
    applyMode(next);
  }

  function applyMode(next: StayBookingMode) {
    setValue("bookingMode", next, { shouldValidate: false });
    setValue("capacity", 0);
    setValue("totalPrice", 0);
    setValue("rooms", next === "rooms" ? [{ ...EMPTY_ROOM }] : []);
    setPendingMode(null);
  }

  async function fetchPreview() {
    const url = getValues("url");
    if (!url) return;
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/link-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.title) setValue("name", data.title.slice(0, 50));
      if (data.image) setValue("imageUrl", data.image);
      if (!data.title && !data.image) {
        showToast("자동으로 불러오지 못했어요. 직접 입력해주세요.", "error");
      }
    } catch {
      showToast("자동으로 불러오지 못했어요. 직접 입력해주세요.", "error");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function onSubmit(values: AccommodationInput) {
    const roomList = values.bookingMode === "rooms" ? values.rooms : [];
    const computed = roomTotals(roomList);
    const finalCapacity = values.bookingMode === "rooms" ? computed.capacity : values.capacity;
    const finalPrice = values.bookingMode === "rooms" ? computed.totalPrice : values.totalPrice;

    if (confirmedParticipantCount && finalCapacity < confirmedParticipantCount) {
      showToast("수용 인원이 여행 인원보다 적어요.", "error");
      return;
    }

    try {
      const supabase = createClient();
      const payload = {
        trip_id: tripId,
        url: values.url,
        name: values.name,
        image_url: values.imageUrl || null,
        location: values.location,
        booking_mode: values.bookingMode,
        rooms: values.bookingMode === "rooms" ? roomList : null,
        total_price: finalPrice,
        capacity: finalCapacity,
        note: values.note || null,
      };

      const { data, error } = editing
        ? await supabase
            .from("accommodations")
            .update(payload)
            .eq("id", editing.id)
            .select()
            .single()
        : await supabase
            .from("accommodations")
            .insert({ ...payload, created_by_participant_id: participantId })
            .select()
            .single();

      if (error) {
        const code = Object.keys(ERROR_MESSAGES).find((k) => error.message.includes(k));
        throw new Error(code ? ERROR_MESSAGES[code] : "저장하지 못했어요.");
      }

      showToast(editing ? "숙소 정보를 수정했어요." : "숙소 후보를 등록했어요.");
      reset();
      // Realtime also delivers this change, but relying on it alone races the
      // subscription's own setup — reflect our own write immediately instead.
      onSaved(data);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "저장하지 못했어요.", "error");
    }
  }

  const priceHint =
    tripDays > 1
      ? `1박이 아니라 ${formatTripLength(tripDays)} 전체 금액이에요.`
      : "여행 기간 전체의 숙박 금액이에요.";

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={editing ? "숙소 정보 수정" : "숙소 후보 추가"}
        footer={
          <div className="flex flex-col gap-3">
            {/* 예약안 요약 — 모바일은 버튼 바로 위, 데스크톱도 폼 하단에 둔다. */}
            {bookingMode && (
              <div className="rounded-2xl bg-primary-soft px-4 py-3">
                <p className="m-0 mb-1 text-xs font-semibold leading-[1.33] text-text-muted">
                  예약안 요약
                </p>
                {isRooms && rooms.length > 0 && (
                  <p className="m-0 mb-0.5 text-[13px] text-ink-soft">
                    {rooms.map((r) => `${r.name || "이름 없음"} ${r.count}개`).join(" · ")}
                  </p>
                )}
                <p className="m-0 text-[15px] font-semibold text-ink">
                  {isRooms ? `객실 ${totals.roomCount}개 · ` : "숙소 전체 사용 · "}
                  최대 {capacity}명
                </p>
                <p className="m-0 text-[15px] font-[650] text-ink">
                  총 {formatPrice(totalPrice)}
                  {perPerson != null && (
                    <span className="font-[450] text-ink-soft">
                      {" "}
                      · 1인 약 {formatPrice(perPerson)}
                    </span>
                  )}
                </p>
              </div>
            )}

            {shortBy > 0 && (
              <div className="flex items-start gap-2 rounded-2xl border border-conflict-pill-border bg-conflict-pill-bg px-4 py-3">
                <span className="mt-0.5 flex shrink-0 text-conflict-text">
                  <TriangleAlert size={16} aria-hidden="true" />
                </span>
                <p className="m-0 text-[13px] leading-[1.45] text-conflict-text">
                  현재 여행 인원은 {confirmedParticipantCount}명이지만 선택한 객실은 최대{" "}
                  {capacity}명까지 이용할 수 있어요. {shortBy}명을 더 수용할 수 있는 객실이
                  필요해요.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 desk:flex-row desk:justify-end">
              {/* 모바일 시트에는 X 가 있으니 취소는 데스크톱 모달에서만.
                  display 유틸을 버튼에 직접 주면 Button 의 inline-flex 와
                  같은 레이어에서 부딪히므로 래퍼로 숨긴다. */}
              <div className="hidden desk:block">
                <Button type="button" variant="soft" onClick={onClose}>
                  취소
                </Button>
              </div>
              <Button
                type="submit"
                form={formId}
                size="lg"
                fullWidth
                disabled={!bookingMode || !capacityOk || totalPrice < 1}
                loading={isSubmitting}
                className="desk:h-11 desk:w-auto"
              >
                {editing ? "수정 완료" : "후보로 등록하기"}
              </Button>
            </div>
          </div>
        }
      >
        <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextInput
                label="숙소 링크"
                placeholder="https://..."
                error={errors.url?.message}
                {...register("url")}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              icon={<Search size={16} aria-hidden="true" />}
              loading={loadingPreview}
              onClick={fetchPreview}
            >
              불러오기
            </Button>
          </div>

          <TextInput label="숙소 이름" error={errors.name?.message} {...register("name")} />
          <TextInput
            label="대표 이미지 주소 (선택)"
            placeholder="https://..."
            error={errors.imageUrl?.message}
            {...register("imageUrl")}
          />
          <TextInput label="위치" error={errors.location?.message} {...register("location")} />

          {/* ── 숙소 이용 방식 ── */}
          <div className="flex flex-col gap-2">
            <p className="m-0 text-xs font-semibold leading-[1.33] text-ink">숙소 이용 방식</p>
            <div role="radiogroup" aria-label="숙소 이용 방식" className="grid grid-cols-2 gap-2">
              {MODE_OPTIONS.map((o) => {
                const selected = bookingMode === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => requestMode(o.value)}
                    className={`inline-flex min-h-11 items-center justify-center rounded-full border px-3 text-sm font-semibold ${
                      selected
                        ? "border-primary bg-primary text-on-primary"
                        : "border-hairline bg-surface text-ink hover:bg-primary-soft"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            {errors.bookingMode?.message && (
              <p className="m-0 text-xs font-medium text-conflict-text">
                {errors.bookingMode.message}
              </p>
            )}
          </div>

          {/* ── 숙소 전체 사용 ── */}
          {bookingMode === "whole" && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-3">
                <TextInput
                  type="number"
                  label="최대 수용 인원"
                  error={errors.capacity?.message}
                  {...register("capacity")}
                />
                <TextInput
                  type="number"
                  label="숙박 전체 금액 (원)"
                  error={errors.totalPrice?.message}
                  {...register("totalPrice")}
                />
              </div>
              <p className="m-0 text-xs leading-[1.33] text-text-muted">
                전체 여행 기간의 숙박 금액을 입력해 주세요. {priceHint}
              </p>
            </div>
          )}

          {/* ── 객실 여러 개 ── */}
          {bookingMode === "rooms" && (
            <div className="flex flex-col gap-3">
              <p className="m-0 text-xs font-semibold leading-[1.33] text-ink">객실 구성</p>

              {fields.map((field, i) => (
                <div
                  key={field.id}
                  className="flex flex-col gap-3 rounded-2xl border border-hairline-soft p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="m-0 text-[13px] font-semibold text-text-muted">객실 {i + 1}</p>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        aria-label={`객실 ${i + 1} 삭제`}
                        onClick={() => remove(i)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-conflict-bg hover:text-conflict-text"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 desk:grid-cols-[1fr_auto] desk:items-end">
                    <TextInput
                      label="객실 이름"
                      placeholder="예: 디럭스 트윈"
                      error={errors.rooms?.[i]?.name?.message}
                      {...register(`rooms.${i}.name` as const)}
                    />
                    <div className="flex flex-col gap-2">
                      <p className="m-0 text-xs font-semibold leading-[1.33] text-ink">객실 수</p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          aria-label={`객실 ${i + 1} 수 줄이기`}
                          onClick={() =>
                            setValue(
                              `rooms.${i}.count`,
                              Math.max(1, Number(getValues(`rooms.${i}.count`) || 1) - 1)
                            )
                          }
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-ink hover:bg-primary-soft"
                        >
                          <Minus size={18} aria-hidden="true" />
                        </button>
                        <input
                          type="number"
                          aria-label={`객실 ${i + 1} 수`}
                          className="h-11 w-16 rounded-2xl border-0 bg-field text-center text-base font-semibold text-ink outline-none focus:shadow-[inset_0_0_0_2px_var(--focus-ring)]"
                          {...register(`rooms.${i}.count` as const)}
                        />
                        <button
                          type="button"
                          aria-label={`객실 ${i + 1} 수 늘리기`}
                          onClick={() =>
                            setValue(
                              `rooms.${i}.count`,
                              Number(getValues(`rooms.${i}.count`) || 1) + 1
                            )
                          }
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-ink hover:bg-primary-soft"
                        >
                          <Plus size={18} aria-hidden="true" />
                        </button>
                      </div>
                      {errors.rooms?.[i]?.count?.message && (
                        <p className="m-0 text-xs font-medium text-conflict-text">
                          {errors.rooms[i]?.count?.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <TextInput
                      type="number"
                      label="객실당 수용 인원"
                      error={errors.rooms?.[i]?.capacityPerRoom?.message}
                      {...register(`rooms.${i}.capacityPerRoom` as const)}
                    />
                    <TextInput
                      type="number"
                      label="객실 1개 전체 금액 (원)"
                      error={errors.rooms?.[i]?.pricePerRoom?.message}
                      {...register(`rooms.${i}.pricePerRoom` as const)}
                    />
                  </div>
                  <p className="m-0 text-xs leading-[1.33] text-text-muted">
                    객실 1개의 전체 여행 기간 숙박 금액을 입력해 주세요. {priceHint}
                  </p>
                </div>
              ))}

              <Button
                type="button"
                variant="soft"
                fullWidth
                icon={<Plus size={16} aria-hidden="true" />}
                iconPosition="start"
                onClick={() => append({ ...EMPTY_ROOM })}
              >
                다른 객실 유형 추가
              </Button>
              {errors.rooms?.message && (
                <p className="m-0 text-xs font-medium text-conflict-text">{errors.rooms.message}</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor={noteId} className="text-xs font-semibold leading-[1.33] text-ink">
              메모 (선택)
            </label>
            <textarea
              id={noteId}
              rows={3}
              maxLength={200}
              className="rounded-2xl border-0 bg-field px-4 py-3 text-base font-[450] text-ink outline-none transition-shadow duration-[120ms] placeholder:text-text-faint focus:shadow-[inset_0_0_0_2px_var(--focus-ring)]"
              {...register("note")}
            />
            {errors.note?.message && (
              <p className="m-0 text-xs font-medium text-conflict-text">{errors.note.message}</p>
            )}
          </div>
        </form>
      </BottomSheet>

      <Modal
        open={pendingMode !== null}
        onClose={() => setPendingMode(null)}
        title="숙소 이용 방식을 변경할까요?"
        description="방식을 변경하면 기존 객실 정보가 초기화돼요."
      >
        <div className="flex flex-col gap-2">
          <Button variant="outline" fullWidth onClick={() => setPendingMode(null)}>
            취소
          </Button>
          <Button fullWidth onClick={() => pendingMode && applyMode(pendingMode)}>
            변경하기
          </Button>
        </div>
      </Modal>
    </>
  );
}
