import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  label?: string;
  tone?: "blue" | "green" | "amber" | "red";
}

const fillTone = {
  blue: "bg-accent",
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-danger",
};

export function ProgressBar({ value, label, tone = "blue" }: ProgressBarProps) {
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs text-muted">
          <span>{label}</span>
          <span>{value}%</span>
        </div>
      )}
      <div className="h-1.5 w-full rounded-full bg-neutral-200">
        <div
          className={cn("h-full rounded-full transition-all", fillTone[tone])}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
