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
        activeCount: items.filter((f) => !isRepaidFund(f)).length,
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
    const cleaned = canonicalRateInput(rate);
    return cleaned ? `${cleaned}%` : "—";
  }
  const n = normalizePercentRate(rate);
  if (n == null) return "—";
  return `${n.toFixed(2)}%`;
}

/** 금리·수수료 최대 소수 자릿수 (그 이상은 부동소수 잔여로 간주) */
const RATE_MAX_FRAC = 4;

/** 1.799999999 → 1.8 등 부동소수 오차 제거 */
export function normalizePercentRate(
  n: number | null | undefined
): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10 ** RATE_MAX_FRAC) / 10 ** RATE_MAX_FRAC;
}

/** 1.8000 → 1.8 (숫자에서 온 값의 trailing zero 제거) */
function trimRateFixed(fixed: string): string {
  if (!fixed.includes(".")) return fixed;
  return fixed.replace(/0+$/, "").replace(/\.$/, "");
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
  // String(1.8)은 보통 안전하지만, 일부 환경/직렬화에서 긴 소수가 생길 수 있어 toFixed 후 trim
  return trimRateFixed(v.toFixed(RATE_MAX_FRAC));
}

/** 입력 문자열 → 저장 문자열 (1.0, 7.0 등 짧은 trailing zero 유지) */
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
  // 1.800000000000000 처럼 과도한 소수 → 부동소수 잔여로 보고 정리
  if (fracLen > RATE_MAX_FRAC) {
    return trimRateFixed(n.toFixed(RATE_MAX_FRAC));
  }
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
  if (typeof rate === "string") return canonicalRateInput(rate) ?? "";
  return rateFromNumber(rate) ?? "";
}

export function progressLabel(value: number | null): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

/** 잔액·상환일 기준으로 운용/상환 판별 (저장 status보다 우선) */
export function deriveLabFundStatus(fund: {
  balance?: number | null;
  repaymentDate?: string | null;
  status?: LabFundStatus;
}): LabFundStatus {
  const balance = fund.balance;
  const repaymentDate = fund.repaymentDate?.trim() || null;
  const hasRepayDate =
    Boolean(repaymentDate) &&
    repaymentDate !== "—" &&
    repaymentDate !== "-";

  if (balance != null && balance <= 0) return "repaid";
  if (hasRepayDate && /^\d{4}-\d{2}-\d{2}$/.test(repaymentDate!)) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const repay = new Date(repaymentDate!);
    if (
      !Number.isNaN(repay.getTime()) &&
      repay <= today &&
      (balance == null || balance <= 0)
    ) {
      return "repaid";
    }
  }
  if (hasRepayDate && (balance == null || balance <= 0)) return "repaid";
  if (balance != null && balance > 0) return "active";
  if (balance == null && !hasRepayDate) {
    return fund.status === "unknown" ? "unknown" : fund.status === "repaid" ? "repaid" : "unknown";
  }
  return "active";
}

/** 상환일이 있거나 상태가 상환인 랩 */
export function isRepaidFund(fund: {
  repaymentDate?: string | null;
  status?: LabFundStatus;
  balance?: number | null;
}): boolean {
  return deriveLabFundStatus(fund) === "repaid";
}
