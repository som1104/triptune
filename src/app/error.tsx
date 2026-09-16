"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold text-ink">문제가 발생했어요.</p>
      <p className="text-sm text-text-muted">네트워크 상태를 확인하고 다시 시도해주세요.</p>
      <Button variant="primary" icon={<RefreshCw size={16} aria-hidden="true" />} onClick={reset}>
        다시 시도
      </Button>
    </div>
  );
}
