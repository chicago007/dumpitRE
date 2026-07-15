import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number | null;
  label?: string;
  tone?: "blue" | "green" | "amber" | "red";
  emptyLabel?: string;
  size?: "sm" | "md";
}

const fillTone = {
  blue: "bg-accent",
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-danger",
};

export function ProgressBar({
  value,
  label,
  tone = "blue",
  emptyLabel = "—",
  size = "sm",
}: ProgressBarProps) {
  const height = size === "md" ? "h-2.5" : "h-1.5";

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs text-muted">
          <span>{label}</span>
          <span className="tabular-nums">
            {value == null ? emptyLabel : `${Math.round(value)}%`}
          </span>
        </div>
      )}
      {value == null ? (
        <div
          className={cn(
            "w-full rounded-full border border-dashed border-neutral-300 bg-neutral-100",
            height
          )}
        />
      ) : (
        <div className={cn("w-full rounded-full bg-neutral-200", height)}>
          <div
            className={cn("h-full rounded-full transition-all", fillTone[tone])}
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
      )}
    </div>
  );
}
