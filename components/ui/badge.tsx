import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "active" | "repaid" | "unknown";
}

const variants = {
  default: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  success: "bg-green-50 text-success ring-1 ring-green-200",
  warning: "bg-amber-50 text-warning ring-1 ring-amber-200",
  danger: "bg-red-50 text-danger ring-1 ring-red-200",
  active: "bg-im-mint/10 text-im-mint ring-1 ring-im-mint/30",
  repaid: "bg-im-purple/35 text-[#6b4fa8] ring-1 ring-im-lime/80",
  unknown: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span className={cn("inline-flex rounded px-2 py-0.5 text-xs font-medium", variants[variant])}>
      {children}
    </span>
  );
}
