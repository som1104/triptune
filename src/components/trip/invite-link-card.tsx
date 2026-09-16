"use client";

import { useEffect, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function InviteLinkCard({ inviteToken, tripTitle }: { inviteToken: string; tripTitle: string }) {
  const { showToast } = useToast();
  const [url, setUrl] = useState<string | null>(null);

  // window.location is unavailable during SSR, so the real URL can only be
  // read after mount. Keeping this null on the client's first render (same
  // as the server) avoids a hydration mismatch; the effect fills it in
  // right after, which is a normal post-hydration update, not a rerender loop.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(`${window.location.origin}/join/${inviteToken}`);
  }, [inviteToken]);

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showToast("링크를 복사했어요.");
    } catch {
      showToast("링크 복사에 실패했어요.", "error");
    }
  }

  async function share() {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: tripTitle, text: `${tripTitle} 여행에 초대할게요.`, url });
      } catch {
        // user cancelled the native share sheet; no toast needed
      }
    } else {
      await copyLink();
    }
  }

  return (
    <div className="rounded-2xl bg-primary-soft p-5">
      <p className="mb-1.5 text-xs font-semibold text-ink-soft">초대 링크</p>
      <p className="mb-4 break-all text-base font-semibold text-ink">
        {url ?? `.../join/${inviteToken}`}
      </p>
      <div className="flex gap-2">
        <Button variant="primary" icon={<Copy size={16} aria-hidden="true" />} fullWidth onClick={copyLink}>
          링크 복사
        </Button>
        <Button variant="outline" icon={<Share2 size={16} aria-hidden="true" />} fullWidth onClick={share}>
          공유
        </Button>
      </div>
    </div>
  );
}
