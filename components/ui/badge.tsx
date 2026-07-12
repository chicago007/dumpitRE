import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}

const variants = {
  default: "bg-neutral-100 text-neutral-700",
  success: "bg-green-50 text-success",
  warning: "bg-amber-50 text-warning",
  danger: "bg-red-50 text-danger",
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span className={cn("inline-flex rounded px-2 py-0.5 text-xs font-medium", variants[variant])}>
      {children}
    </span>
  );
}
