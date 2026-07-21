import { cn } from "@/lib/utils";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";

interface RatioBarItemBase {
  label: string;
  barClass?: string;
}

interface RatioBarItemWithRatio extends RatioBarItemBase {
  numeratorLabel: string;
  denominatorLabel: string;
  numeratorValue: string;
  denominatorValue: string;
  ratio: number;
}

interface RatioBarItemWithValue extends RatioBarItemBase {
  simpleValue: string;
}

export type RatioBarItem = RatioBarItemWithRatio | RatioBarItemWithValue;

interface RatioBarsProps {
  items: RatioBarItem[];
  /** 헤더 제목 옆 인라인 표시 */
  compact?: boolean;
}

function ratioPct(ratio: number) {
  return Number.isFinite(ratio) ? Math.min(100, Math.max(0, ratio * 100)) : 0;
}

export function RatioBars({ items, compact }: RatioBarsProps) {
  if (compact) {
    return (
      <HorizontalScroll className="min-w-0 flex-1">
        <div className="flex min-w-max items-stretch gap-4 px-1">
          {items.map((item, i) => {
            if ("simpleValue" in item) {
              const valueClass = (item.barClass ?? "bg-accent").replace("bg-", "text-");
              return (
                <div
                  key={item.label}
                  className={cn(
                    "flex min-w-[5.5rem] flex-col justify-center",
                    i > 0 && "border-l border-border/70 pl-4"
                  )}
                >
                  <p className="text-[10px] font-medium text-muted">{item.label}</p>
                  <p className={cn("mt-0.5 text-sm font-bold tabular-nums", valueClass)}>
                    {item.simpleValue}
                  </p>
                </div>
              );
            }

            const pct = ratioPct(item.ratio);
            const barClass = item.barClass ?? "bg-accent";
            return (
              <div
                key={item.label}
                className={cn(
                  "min-w-[9rem] shrink-0",
                  i > 0 && "border-l border-border/70 pl-4"
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[10px] font-medium text-muted">{item.label}</p>
                  <p className="text-xs font-semibold tabular-nums">{pct.toFixed(0)}%</p>
                </div>
                <p className="mt-0.5 text-[10px] text-muted">
                  <span className={cn("font-semibold", barClass.replace("bg-", "text-"))}>
                    {item.numeratorValue}
                  </span>
                  <span className="mx-0.5 text-muted/70">/</span>
                  <span className="font-medium text-foreground">{item.denominatorValue}</span>
                </p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={cn("h-full rounded-full", barClass)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </HorizontalScroll>
    );
  }

  return (
    <div className="shadow-card rounded-xl border border-border bg-card px-5 py-4">
      <HorizontalScroll>
        <div
          className={cn(
            "grid gap-8",
            items.length >= 3
              ? "min-w-[700px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px]"
              : "min-w-[520px] grid-cols-2"
          )}
        >
        {items.map((item) => {
          if ("simpleValue" in item) {
            const valueClass = (item.barClass ?? "bg-accent").replace("bg-", "text-");
            return (
              <div
                key={item.label}
                className="flex min-w-0 flex-col items-end justify-center text-right"
              >
                <p className="text-xs font-medium text-muted">{item.label}</p>
                <p className={cn("mt-2 text-xl font-bold tabular-nums", valueClass)}>
                  {item.simpleValue}
                </p>
              </div>
            );
          }

          const pct = ratioPct(item.ratio);
          const barClass = item.barClass ?? "bg-accent";
          return (
            <div key={item.label} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-medium text-muted">{item.label}</p>
                <p className="text-sm font-semibold tabular-nums">{pct.toFixed(0)}%</p>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <p className="text-xs text-muted">
                  <span className={cn("font-semibold", barClass.replace("bg-", "text-"))}>
                    {item.numeratorValue}
                  </span>
                  <span className="mx-1 text-muted/70">/</span>
                  <span className="font-medium text-foreground">{item.denominatorValue}</span>
                </p>
                <p className="truncate text-[11px] text-muted">
                  {item.numeratorLabel} / {item.denominatorLabel}
                </p>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={cn("h-full rounded-full transition-all duration-700 ease-out", barClass)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        </div>
      </HorizontalScroll>
    </div>
  );
}
