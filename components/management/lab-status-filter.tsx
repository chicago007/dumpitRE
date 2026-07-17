"use client";

import type { LabFund } from "@/lib/types";

export type LabStatusFilter = "all" | "active" | "repaid";

const TABS: { id: LabStatusFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "active", label: "진행중" },
  { id: "repaid", label: "상환" },
];

export function filterFundsByStatus(
  funds: LabFund[],
  filter: LabStatusFilter
): LabFund[] {
  if (filter === "all") return funds;
  return funds.filter((f) => f.status === filter);
}

export function LabStatusFilterTabs({
  value,
  onChange,
}: {
  value: LabStatusFilter;
  onChange: (next: LabStatusFilter) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-border bg-card p-1 shadow-card">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === id
              ? "bg-accent font-semibold text-accent-foreground shadow-sm"
              : "text-muted hover:bg-accent/10 hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
