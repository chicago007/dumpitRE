import { cn } from "@/lib/utils";

/** 좁은 화면에서도 표·그리드가 세로로 쌓이지 않고 가로 스크롤 */
export function HorizontalScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-full overflow-x-auto overscroll-x-contain", className)}>
      {children}
    </div>
  );
}
