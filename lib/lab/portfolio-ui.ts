import type { LabFund, LabFundStatus } from "@/lib/types";

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

export function formatRate(rate: string | number | null): string {
  if (rate == null || rate === "") return "—";
  // 마스터·엑셀은 %p 그대로 저장 (1.0 = 1.0%, 6.2 = 6.2%)
  if (typeof rate === "string") {
    const s = rate.trim().replace(/%/g, "");
    return s ? `${s}%` : "—";
  }
  const n = normalizePercentRate(rate);
  if (n == null) return "—";
  return `${n.toFixed(2)}%`;
}

/** 1.799999999 → 1.8 등 부동소수 오차 제거 */
export function normalizePercentRate(
  n: number | null | undefined
): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

export function rateToNumber(
  rate: string | number | null | undefined
): number | null {
  if (rate == null || rate === "") return null;
  const n =
    typeof rate === "number"
      ? rate
      : Number(String(rate).trim().replace(/%/g, ""));
  return normalizePercentRate(n);
}

/** 숫자 → 저장 문자열 (엑셀·제안서 등, 입력 자릿수 정보 없음) */
export function rateFromNumber(n: number | null | undefined): string | null {
  const v = normalizePercentRate(n);
  if (v == null) return null;
  return String(v);
}

/** 입력 문자열 → 저장 문자열 (1.0, 7.0 등 trailing zero 유지) */
export function canonicalRateInput(text: string): string | null {
  const s = text.trim().replace(/%/g, "");
  if (!s || s === "-" || s === ".") return null;
  if (!/^\d+(\.\d*)?$/.test(s)) return null;
  const n = normalizePercentRate(Number(s));
  if (n == null) return null;
  const dot = s.indexOf(".");
  if (dot === -1) return String(Math.trunc(n));
  const fracLen = s.length - dot - 1;
  if (fracLen === 0) return String(Math.trunc(n));
  return n.toFixed(fracLen);
}

/** JSON 로드·API 저장 시 number|string 혼용 호환 */
export function normalizeRateValue(
  v: string | number | null | undefined
): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") return canonicalRateInput(v) ?? null;
  return rateFromNumber(v);
}

/** 관리 테이블 입력 표시 */
export function formatRateInput(
  rate: string | number | null | undefined
): string {
  if (rate == null || rate === "") return "";
  if (typeof rate === "string") return rate;
  return rateFromNumber(rate) ?? "";
}

export function progressLabel(value: number | null): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

/** 상환일이 있거나 상태가 상환인 랩 */
export function isRepaidFund(fund: {
  repaymentDate?: string | null;
  status?: LabFundStatus;
}): boolean {
  if (fund.status === "repaid") return true;
  const d = fund.repaymentDate?.trim();
  return Boolean(d && d !== "—" && d !== "-");
}
