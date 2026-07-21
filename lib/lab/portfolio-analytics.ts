import type { LabFund } from "@/lib/types";
import { formatRate, rateToNumber } from "@/lib/lab/portfolio-ui";
import { formatCurrency } from "@/lib/utils";

export type PeriodMode = "month" | "year";

export interface PeriodAmountRow {
  key: string;
  label: string;
  setup: number;
  repayment: number;
}

export interface PeriodFeeRow {
  key: string;
  label: string;
  /** 설정액 가중평균 수수료율(%) */
  weightedFeeRate: number;
  /** 수수료 합계 (설정액 × 수수료율) */
  feeAmount: number;
  count: number;
}

export interface EntityAggregate {
  label: string;
  amount: number;
  count: number;
}

export interface RegionAggregate {
  label: string;
  amount: number;
  count: number;
}

export interface MaturityMonthRow {
  key: string;
  label: string;
  loanCount: number;
  fundCount: number;
  earlyCount: number;
  loanAmount: number;
  fundAmount: number;
  earlyAmount: number;
}

export interface InterestMonthRow {
  key: string;
  label: string;
  paymentCount: number;
}

function periodKey(date: string, mode: PeriodMode): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return mode === "year" ? date.slice(0, 4) : date.slice(0, 7);
}

function formatPeriodLabel(key: string, mode: PeriodMode): string {
  if (mode === "year") return `${key}년`;
  const [y, m] = key.split("-");
  return `${y}년 ${Number(m)}월`;
}

export function yearsFromPeriodKeys(rows: { key: string }[]): string[] {
  const years = new Set<string>();
  for (const row of rows) {
    if (/^\d{4}-\d{2}$/.test(row.key)) years.add(row.key.slice(0, 4));
    else if (/^\d{4}$/.test(row.key)) years.add(row.key);
  }
  return [...years].sort();
}

export function filterRowsByYear<T extends { key: string }>(
  rows: T[],
  year: string | null
): T[] {
  if (!year) return rows;
  return rows.filter((r) => r.key.startsWith(`${year}-`) || r.key === year);
}

/** 선택 연도의 1~12월 빈 구간을 0으로 채움 */
export function fillMonthlyGaps(rows: PeriodAmountRow[], year: string): PeriodAmountRow[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, "0");
    const key = `${year}-${month}`;
    return (
      byKey.get(key) ?? {
        key,
        label: `${i + 1}월`,
        setup: 0,
        repayment: 0,
      }
    );
  });
}

export function fillMonthlyFeeGaps(rows: PeriodFeeRow[], year: string): PeriodFeeRow[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, "0");
    const key = `${year}-${month}`;
    return (
      byKey.get(key) ?? {
        key,
        label: `${i + 1}월`,
        weightedFeeRate: 0,
        feeAmount: 0,
        count: 0,
      }
    );
  });
}

export function fillMaturityMonthlyGaps(rows: MaturityMonthRow[], year: string): MaturityMonthRow[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, "0");
    const key = `${year}-${month}`;
    return (
      byKey.get(key) ?? {
        key,
        label: `${i + 1}월`,
        loanCount: 0,
        fundCount: 0,
        earlyCount: 0,
        loanAmount: 0,
        fundAmount: 0,
        earlyAmount: 0,
      }
    );
  });
}

export function fillInterestMonthlyGaps(rows: InterestMonthRow[], year: string): InterestMonthRow[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, "0");
    const key = `${year}-${month}`;
    return (
      byKey.get(key) ?? {
        key,
        label: `${i + 1}월`,
        paymentCount: 0,
      }
    );
  });
}

/** ㈜/(주) 등 표기 통일 */
export function normalizeEntityName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const s = name
    .trim()
    .replace(/㈜|\(주\)|\(유\)|주식회사|주\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s || name.trim();
}

/** 사업장 주소 → 시·구 단위 */
export function extractRegion(address: string | null | undefined): string {
  if (!address?.trim()) return "미기재";
  const s = address.trim().split(/\r?\n/)[0].trim();
  const withProvince = s.match(
    /^([가-힣]+도)\s+([가-힣]+시)\s*([가-힣]+[구군])?/
  );
  if (withProvince) {
    return [withProvince[2], withProvince[3]].filter(Boolean).join(" ");
  }
  const metro = s.match(/^([가-힣]+특별시|[가-힣]+광역시)\s*([가-힣]+[구군])?/);
  if (metro) {
    return [metro[1].replace(/특별시|광역시/, "시"), metro[2]]
      .filter(Boolean)
      .join(" ");
  }
  const city = s.match(/^([가-힣]+시)\s*([가-힣]+[구군])?/);
  if (city) return [city[1], city[2]].filter(Boolean).join(" ");
  return s.split(/\s+/).slice(0, 2).join(" ") || "기타";
}

/** 설정일·상환일 기준 설정액 집계 (상환액 = 상환일 기준 setupAmount) */
export function aggregateSetupRepayment(
  funds: LabFund[],
  mode: PeriodMode
): PeriodAmountRow[] {
  const map = new Map<string, { setup: number; repayment: number }>();

  for (const f of funds) {
    const amount = f.setupAmount ?? 0;
    if (amount <= 0) continue;

    if (f.setupDate) {
      const key = periodKey(f.setupDate, mode);
      if (key) {
        const row = map.get(key) ?? { setup: 0, repayment: 0 };
        row.setup += amount;
        map.set(key, row);
      }
    }
    if (f.repaymentDate) {
      const key = periodKey(f.repaymentDate, mode);
      if (key) {
        const row = map.get(key) ?? { setup: 0, repayment: 0 };
        row.repayment += amount;
        map.set(key, row);
      }
    }
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      key,
      label: formatPeriodLabel(key, mode),
      setup: v.setup,
      repayment: v.repayment,
    }));
}

/** 설정액 × 수수료율(%) */
export function calcFundFeeAmount(fund: LabFund): number {
  const setup = fund.setupAmount ?? 0;
  const rate = rateToNumber(fund.feeRate);
  if (setup <= 0 || rate == null) return 0;
  return setup * (rate / 100);
}

/** 설정일 기준 수수료율·수수료액 집계 */
export function aggregateFeeByPeriod(funds: LabFund[], mode: PeriodMode): PeriodFeeRow[] {
  const map = new Map<
    string,
    { feeAmount: number; weightedRateSum: number; setupSum: number; count: number }
  >();

  for (const f of funds) {
    const setup = f.setupAmount ?? 0;
    const rate = rateToNumber(f.feeRate);
    if (!f.setupDate || setup <= 0 || rate == null) continue;

    const key = periodKey(f.setupDate, mode);
    if (!key) continue;

    const fee = setup * (rate / 100);
    const row = map.get(key) ?? {
      feeAmount: 0,
      weightedRateSum: 0,
      setupSum: 0,
      count: 0,
    };
    row.feeAmount += fee;
    row.weightedRateSum += setup * rate;
    row.setupSum += setup;
    row.count += 1;
    map.set(key, row);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      key,
      label: formatPeriodLabel(key, mode),
      feeAmount: v.feeAmount,
      weightedFeeRate: v.setupSum > 0 ? v.weightedRateSum / v.setupSum : 0,
      count: v.count,
    }));
}

export function aggregateByEntity(
  funds: LabFund[],
  field: "trustCompany" | "developer" | "contractor" | "purchaseAgency"
): EntityAggregate[] {
  const map = new Map<string, { amount: number; count: number }>();

  for (const f of funds) {
    const raw = f[field];
    const label = normalizeEntityName(raw) ?? raw?.trim();
    if (!label) continue;
    const row = map.get(label) ?? { amount: 0, count: 0 };
    row.amount += f.setupAmount ?? 0;
    row.count += 1;
    map.set(label, row);
  }

  return [...map.entries()]
    .map(([label, v]) => ({ label, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 12);
}

export function aggregateByRegion(funds: LabFund[]): RegionAggregate[] {
  const map = new Map<string, { amount: number; count: number }>();

  for (const f of funds) {
    const label = extractRegion(f.siteAddress);
    const row = map.get(label) ?? { amount: 0, count: 0 };
    row.amount += f.setupAmount ?? 0;
    row.count += 1;
    map.set(label, row);
  }

  return [...map.entries()]
    .map(([label, v]) => ({ label, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 12);
}

function bumpMaturity(
  map: Map<
    string,
    {
      loanCount: number;
      fundCount: number;
      earlyCount: number;
      loanAmount: number;
      fundAmount: number;
      earlyAmount: number;
    }
  >,
  date: string | null,
  kind: "loan" | "fund" | "early",
  amount: number,
  mode: PeriodMode
) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const key = periodKey(date, mode);
  if (!key) return;
  const row = map.get(key) ?? {
    loanCount: 0,
    fundCount: 0,
    earlyCount: 0,
    loanAmount: 0,
    fundAmount: 0,
    earlyAmount: 0,
  };
  if (kind === "loan") {
    row.loanCount += 1;
    row.loanAmount += amount;
  } else if (kind === "fund") {
    row.fundCount += 1;
    row.fundAmount += amount;
  } else {
    row.earlyCount += 1;
    row.earlyAmount += amount;
  }
  map.set(key, row);
}

/** 중도상환·대출만기·펀드만기 연도별/월별 집계 */
export function aggregateMaturityByPeriod(
  funds: LabFund[],
  mode: PeriodMode
): MaturityMonthRow[] {
  const map = new Map<
    string,
    {
      loanCount: number;
      fundCount: number;
      earlyCount: number;
      loanAmount: number;
      fundAmount: number;
      earlyAmount: number;
    }
  >();

  for (const f of funds) {
    const amt = f.setupAmount ?? f.balance ?? 0;
    bumpMaturity(map, f.earlyRepaymentDate, "early", amt, mode);
    bumpMaturity(map, f.loanMaturityDate, "loan", amt, mode);
    bumpMaturity(map, f.maturityDate, "fund", amt, mode);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      key,
      label: formatPeriodLabel(key, mode),
      ...v,
    }));
}

/** @deprecated use aggregateMaturityByPeriod */
export function aggregateMaturityByMonth(funds: LabFund[]): MaturityMonthRow[] {
  return aggregateMaturityByPeriod(funds, "month");
}

/** 이자 분배(회차 지급일) 연도별/월별 건수 */
export function aggregateInterestByPeriod(
  funds: LabFund[],
  mode: PeriodMode
): InterestMonthRow[] {
  const map = new Map<string, number>();

  for (const f of funds) {
    for (const p of f.interestPayments ?? []) {
      const d = p.date?.trim();
      if (!d) continue;
      const iso = d.match(/^(\d{4})-(\d{2})/);
      if (!iso) continue;
      const key = mode === "year" ? iso[1] : `${iso[1]}-${iso[2]}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, paymentCount]) => ({
      key,
      label: formatPeriodLabel(key, mode),
      paymentCount,
    }));
}

/** @deprecated use aggregateInterestByPeriod */
export function aggregateInterestByMonth(funds: LabFund[]): InterestMonthRow[] {
  return aggregateInterestByPeriod(funds, "month");
}

export function amountToEok(amount: number): number {
  return amount / 100_000_000;
}

export interface DrillDownItem {
  id: string;
  fundId: string;
  fundName: string;
  sublabel?: string;
  amount?: number | null;
  date?: string | null;
}

function dateMatchesPeriod(
  date: string | null | undefined,
  targetKey: string,
  mode: PeriodMode
): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const key = periodKey(date, mode);
  return key === targetKey;
}

export function listSetupRepaymentDetails(
  funds: LabFund[],
  targetKey: string,
  mode: PeriodMode
): { setup: DrillDownItem[]; repayment: DrillDownItem[] } {
  const setup: DrillDownItem[] = [];
  const repayment: DrillDownItem[] = [];

  for (const f of funds) {
    const amount = f.setupAmount ?? 0;
    if (amount <= 0) continue;

    if (dateMatchesPeriod(f.setupDate, targetKey, mode)) {
      setup.push({
        id: `${f.id}-setup`,
        fundId: f.id,
        fundName: f.name,
        sublabel: "설정",
        amount,
        date: f.setupDate,
      });
    }
    if (dateMatchesPeriod(f.repaymentDate, targetKey, mode)) {
      repayment.push({
        id: `${f.id}-repay`,
        fundId: f.id,
        fundName: f.name,
        sublabel: "상환",
        amount,
        date: f.repaymentDate,
      });
    }
  }

  setup.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  repayment.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  return { setup, repayment };
}

export function listFeeDetails(
  funds: LabFund[],
  targetKey: string,
  mode: PeriodMode
): DrillDownItem[] {
  const items: DrillDownItem[] = [];

  for (const f of funds) {
    const setup = f.setupAmount ?? 0;
    const rate = rateToNumber(f.feeRate);
    if (!dateMatchesPeriod(f.setupDate, targetKey, mode) || setup <= 0 || rate == null) {
      continue;
    }
    const fee = setup * (rate / 100);
    items.push({
      id: `${f.id}-fee`,
      fundId: f.id,
      fundName: f.name,
      sublabel: `수수료율 ${formatRate(f.feeRate)} · 설정액 ${formatCurrency(setup)}`,
      amount: fee,
      date: f.setupDate,
    });
  }

  items.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  return items;
}

export function listMaturityDetails(
  funds: LabFund[],
  targetKey: string,
  mode: PeriodMode
): { early: DrillDownItem[]; loan: DrillDownItem[]; fund: DrillDownItem[] } {
  const early: DrillDownItem[] = [];
  const loan: DrillDownItem[] = [];
  const fund: DrillDownItem[] = [];

  for (const f of funds) {
    const amount = f.setupAmount ?? f.balance ?? 0;
    if (dateMatchesPeriod(f.earlyRepaymentDate, targetKey, mode)) {
      early.push({
        id: `${f.id}-early`,
        fundId: f.id,
        fundName: f.name,
        sublabel: "중도상환",
        amount,
        date: f.earlyRepaymentDate,
      });
    }
    if (dateMatchesPeriod(f.loanMaturityDate, targetKey, mode)) {
      loan.push({
        id: `${f.id}-loan`,
        fundId: f.id,
        fundName: f.name,
        sublabel: "대출만기",
        amount,
        date: f.loanMaturityDate,
      });
    }
    if (dateMatchesPeriod(f.maturityDate, targetKey, mode)) {
      fund.push({
        id: `${f.id}-fund`,
        fundId: f.id,
        fundName: f.name,
        sublabel: "펀드만기",
        amount,
        date: f.maturityDate,
      });
    }
  }

  early.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  loan.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  fund.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  return { early, loan, fund };
}

export function listInterestDetails(
  funds: LabFund[],
  targetKey: string,
  mode: PeriodMode
): DrillDownItem[] {
  const items: DrillDownItem[] = [];

  for (const f of funds) {
    for (const p of f.interestPayments ?? []) {
      const d = p.date?.trim();
      if (!d) continue;
      const iso = d.match(/^(\d{4})-(\d{2})/);
      if (!iso) continue;
      const key = mode === "year" ? iso[1] : `${iso[1]}-${iso[2]}`;
      if (key !== targetKey) continue;
      items.push({
        id: `${f.id}-pay-${p.round}-${d}`,
        fundId: f.id,
        fundName: f.name,
        sublabel: `${p.round}회차`,
        date: p.raw ?? d,
      });
    }
  }

  items.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  return items;
}

export function listEntityDetails(
  funds: LabFund[],
  field: "trustCompany" | "developer" | "contractor" | "purchaseAgency",
  label: string
): DrillDownItem[] {
  return funds
    .filter((f) => {
      const raw = f[field];
      const entity = normalizeEntityName(raw) ?? raw?.trim();
      return entity === label;
    })
    .map((f) => ({
      id: f.id,
      fundId: f.id,
      fundName: f.name,
      sublabel: f.siteAddress ?? undefined,
      amount: f.setupAmount,
      date: f.setupDate,
    }))
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
}

export function listRegionDetails(funds: LabFund[], region: string): DrillDownItem[] {
  return funds
    .filter((f) => extractRegion(f.siteAddress) === region)
    .map((f) => ({
      id: f.id,
      fundId: f.id,
      fundName: f.name,
      sublabel: f.siteAddress ?? undefined,
      amount: f.setupAmount,
      date: f.setupDate,
    }))
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
}
