import type { LabFund } from "@/lib/types";

/** "부동산랩 10호" → 10 (호수 숫자 정렬용) */
export function labOrderNumber(name: string): number {
  const m = name.match(/(\d+)\s*호/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

export function compareLabFunds(a: LabFund, b: LabFund): number {
  const na = labOrderNumber(a.name);
  const nb = labOrderNumber(b.name);
  // 호수 내림차순 (61호 → 1호)
  if (na !== nb) return nb - na;
  return b.name.localeCompare(a.name, "ko");
}

export function sortLabFunds(funds: LabFund[]): LabFund[] {
  return [...funds].sort(compareLabFunds);
}

export function siteKey(fund: LabFund): string {
  return (fund.siteAddress ?? "").trim() || "__none__";
}

export function siteLabel(key: string): string {
  return key === "__none__" ? "사업장 미기재" : key;
}

export function encodeSiteParam(key: string): string {
  return encodeURIComponent(key);
}

export function decodeSiteParam(param: string | null): string | null {
  if (!param) return null;
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

export interface SiteGroup {
  key: string;
  address: string;
  funds: LabFund[];
  activeCount: number;
  totalBalance: number;
  totalSetup: number;
  maxRound: number;
  avgActualProgress: number | null;
  avgPlannedProgress: number | null;
}

export function groupFundsBySite(funds: LabFund[]): SiteGroup[] {
  const map = new Map<string, LabFund[]>();
  for (const fund of funds) {
    const key = siteKey(fund);
    const list = map.get(key) ?? [];
    list.push(fund);
    map.set(key, list);
  }

  return [...map.entries()]
    .map(([key, items]) => {
      const actuals = items
        .map((f) => f.actualProgressPct)
        .filter((n): n is number => n != null);
      const planned = items
        .map((f) => f.plannedProgressPct)
        .filter((n): n is number => n != null);
      const rounds = items.flatMap((f) => f.interestPayments.map((p) => p.round));
      return {
        key,
        address: siteLabel(key),
        funds: items.sort(compareLabFunds),
        activeCount: items.filter((f) => f.status === "active").length,
        totalBalance: items.reduce((s, f) => s + (f.balance ?? 0), 0),
        totalSetup: items.reduce((s, f) => s + (f.setupAmount ?? 0), 0),
        maxRound: rounds.length ? Math.max(...rounds) : 0,
        avgActualProgress:
          actuals.length > 0 ? actuals.reduce((a, b) => a + b, 0) / actuals.length : null,
        avgPlannedProgress:
          planned.length > 0 ? planned.reduce((a, b) => a + b, 0) / planned.length : null,
      };
    })
    .sort((a, b) => {
      if (a.key === "__none__") return 1;
      if (b.key === "__none__") return -1;
      return a.address.localeCompare(b.address, "ko");
    });
}

export function formatRate(rate: number | null): string {
  if (rate == null) return "—";
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${pct.toFixed(2)}%`;
}

export function progressLabel(value: number | null): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}
