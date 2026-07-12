import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}

const toneClasses = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-accent",
};

export function StatCard({ label, value, tone = "default" }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className={cn("text-2xl font-semibold tabular-nums", toneClasses[tone])}>{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}
