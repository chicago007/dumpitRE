import { cn } from "@/lib/utils";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";

export interface RatioBarItem {
  label: string;
  numeratorLabel: string;
  denominatorLabel: string;
  numeratorValue: string;
  denominatorValue: string;
  ratio: number;
  barClass?: string;
}

interface RatioBarsProps {
  items: RatioBarItem[];
}

export function RatioBars({ items }: RatioBarsProps) {
  return (
    <div className="shadow-card rounded-xl border border-border bg-card px-5 py-4">
      <HorizontalScroll>
        <div className="grid min-w-[520px] grid-cols-2 gap-8">
        {items.map((item) => {
          const pct = Number.isFinite(item.ratio)
            ? Math.min(100, Math.max(0, item.ratio * 100))
            : 0;
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
