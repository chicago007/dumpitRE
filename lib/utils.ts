import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  if (amount >= 100_000_000) {
    return `${(amount / 100_000_000).toFixed(0)}억`;
  }
  if (amount >= 10_000) {
    return `${Math.round(amount / 10_000).toLocaleString()}만`;
  }
  return amount.toLocaleString("ko-KR");
}

export function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

export function isDelayed(site: { latestProgressPct: number | null; plannedProgressPct: number | null }): boolean {
  if (site.latestProgressPct == null || site.plannedProgressPct == null) return false;
  return site.latestProgressPct < site.plannedProgressPct - 5;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    planned: "예정",
    in_progress: "진행중",
    completed: "완료",
    suspended: "중단",
  };
  return map[status] ?? status;
}
