import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold text-ink">페이지를 찾을 수 없어요.</p>
      <p className="text-sm text-text-muted">주소가 잘못되었거나 더 이상 존재하지 않는 페이지예요.</p>
      <LinkButton href="/">처음으로</LinkButton>
    </div>
  );
}
