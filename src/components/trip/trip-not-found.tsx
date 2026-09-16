import { LinkButton } from "@/components/ui/button";

export function TripNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold text-ink">이 여행을 찾을 수 없어요.</p>
      <p className="text-sm text-text-muted">
        링크가 잘못되었거나, 삭제되었거나, 접근 권한이 없는 여행일 수 있어요.
      </p>
      <LinkButton href="/" variant="outline">
        새 여행 만들기
      </LinkButton>
    </div>
  );
}
