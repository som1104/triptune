"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TextInput } from "@/components/ui/text-input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { accommodationSchema, type AccommodationInput } from "@/lib/validation/accommodation";
import type { Accommodation } from "@/lib/supabase/database.types";

const ERROR_MESSAGES: Record<string, string> = {
  ACCOMMODATION_LIMIT_TOTAL: "숙소 후보는 최대 5개까지 등록할 수 있어요.",
  ACCOMMODATION_LIMIT_PER_PARTICIPANT: "1인당 최대 2개까지 등록할 수 있어요.",
};

export function AddAccommodationSheet({
  open,
  onClose,
  tripId,
  participantId,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  participantId: string;
  editing: Accommodation | null;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [loadingPreview, setLoadingPreview] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
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
          totalPrice: editing.total_price,
          capacity: editing.capacity,
          note: editing.note ?? "",
        }
      : { url: "", name: "", imageUrl: "", location: "", totalPrice: 0, capacity: 1, note: "" },
  });

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
    try {
      const supabase = createClient();
      const payload = {
        trip_id: tripId,
        url: values.url,
        name: values.name,
        image_url: values.imageUrl || null,
        location: values.location,
        total_price: values.totalPrice,
        capacity: values.capacity,
        note: values.note || null,
      };

      const { error } = editing
        ? await supabase.from("accommodations").update(payload).eq("id", editing.id)
        : await supabase
            .from("accommodations")
            .insert({ ...payload, created_by_participant_id: participantId });

      if (error) {
        const code = Object.keys(ERROR_MESSAGES).find((k) => error.message.includes(k));
        throw new Error(code ? ERROR_MESSAGES[code] : "저장하지 못했어요.");
      }

      showToast(editing ? "숙소 정보를 수정했어요." : "숙소 후보를 추가했어요.");
      reset();
      onSaved();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "저장하지 못했어요.", "error");
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={editing ? "숙소 정보 수정" : "숙소 후보 추가"}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextInput label="숙소 링크" placeholder="https://..." error={errors.url?.message} {...register("url")} />
            </div>
            <Button
              type="button"
              variant="outline"
              icon={<Search size={16} aria-hidden="true" />}
              loading={loadingPreview}
              onClick={fetchPreview}
            >
              불러오기
            </Button>
          </div>
        </div>

        <TextInput label="숙소 이름" error={errors.name?.message} {...register("name")} />
        <TextInput label="대표 이미지 주소 (선택)" placeholder="https://..." error={errors.imageUrl?.message} {...register("imageUrl")} />
        <TextInput label="위치" error={errors.location?.message} {...register("location")} />

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            type="number"
            label="총 숙박 가격 (원)"
            error={errors.totalPrice?.message}
            {...register("totalPrice")}
          />
          <TextInput type="number" label="최대 수용 인원" error={errors.capacity?.message} {...register("capacity")} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="note" className="text-xs font-semibold text-ink">
            메모 (선택)
          </label>
          <textarea
            id="note"
            rows={3}
            maxLength={200}
            className="rounded-xl border border-hairline px-4 py-3 text-[15px] text-ink outline-none focus:border-primary"
            {...register("note")}
          />
          {errors.note?.message && <p className="text-xs font-medium text-conflict-text">{errors.note.message}</p>}
        </div>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting} className="mt-2">
          {editing ? "수정 완료" : "추가하기"}
        </Button>
      </form>
    </BottomSheet>
  );
}
