"use client";

import { cn } from "@/lib/utils";

interface PillProps {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function Pill({ active, onClick, children }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-sm transition-colors",
        active
          ? "bg-foreground text-white"
          : "bg-neutral-100 text-muted hover:bg-neutral-200 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
