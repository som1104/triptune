export function StageLocked({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
      <p className="text-[15px] leading-relaxed text-text-muted">{message}</p>
    </div>
  );
}
