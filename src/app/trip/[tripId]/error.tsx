"use client";

import { RefreshCw } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";

export default function TripError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold text-ink">문제가 발생했어요.</p>
      <p className="text-sm text-text-muted">네트워크 상태를 확인하고 다시 시도해주세요.</p>
      <div className="flex w-full flex-col gap-2">
        <Button variant="primary" fullWidth icon={<RefreshCw size={16} aria-hidden="true" />} onClick={reset}>
          다시 시도
        </Button>
        <LinkButton href="/" variant="outline" fullWidth>
          처음으로
        </LinkButton>
      </div>
    </div>
  );
}
