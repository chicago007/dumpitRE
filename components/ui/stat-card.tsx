import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  hint?: string;
}

const toneClasses = {
  default: "text-foreground border-t-neutral-300",
  success: "text-success border-t-success",
  warning: "text-warning border-t-warning",
  danger: "text-danger border-t-danger",
  info: "text-accent border-t-accent",
};

export function StatCard({ label, value, tone = "default", hint }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border border-t-4 bg-card p-4 shadow-sm",
        toneClasses[tone]
      )}
    >
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-muted/80">{hint}</p>}
    </div>
  );
}
