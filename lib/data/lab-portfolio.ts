import fs from "fs";
import path from "path";
import { parseLabStatusExcel } from "@/lib/analyzers/lab-status-excel";
import {
  rememberDeletedMaster,
  restoreDeletedMaster,
} from "@/lib/data/deleted-masters";
import { normalizeRateValue } from "@/lib/lab/portfolio-ui";
import type { LabFund, LabInterestPayment, LabPortfolioSnapshot } from "@/lib/types";

const PERSIST_PATH = path.join(process.cwd(), ".data", "lab-portfolio.json");
const DELETED_LABS_PATH = path.join(process.cwd(), ".data", "deleted-labs.json");

let snapshot: LabPortfolioSnapshot | null = null;
let seeded = false;
let deletedLabKeys: Set<string> | null = null;

function recomputeStats(funds: LabFund[]): LabPortfolioSnapshot["stats"] {
  return {
    totalCount: funds.length,
    activeCount: funds.filter((f) => f.status === "active").length,
    repaidCount: funds.filter((f) => f.status === "repaid").length,
    totalSetupAmount: funds.reduce((s, f) => s + (f.setupAmount ?? 0), 0),
    totalBalance: funds.reduce((s, f) => s + (f.balance ?? 0), 0),
  };
}

function persistSnapshot() {
  if (!snapshot) return;
  try {
    fs.mkdirSync(path.dirname(PERSIST_PATH), { recursive: true });
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(snapshot, null, 2));
  } catch (err) {
    console.warn("[lab-portfolio] persist failed:", err);
  }
}

function commit(funds: LabFund[], fileName?: string): LabPortfolioSnapshot {
  snapshot = {
    uploadedAt: new Date().toISOString(),
    fileName: fileName ?? snapshot?.fileName ?? "수동 편집",
    funds,
    stats: recomputeStats(funds),
  };
  persistSnapshot();
  return snapshot;
}

function loadDeletedLabs(): Set<string> {
  if (deletedLabKeys) return deletedLabKeys;
  deletedLabKeys = new Set();
  try {
    if (fs.existsSync(DELETED_LABS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(DELETED_LABS_PATH, "utf8")) as string[];
      for (const k of raw) deletedLabKeys.add(k);
    }
  } catch {
    /* ignore */
  }
  return deletedLabKeys;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, "").toLowerCase();
}

function addrOverlap(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y || x.length < 4 || y.length < 4) return false;
  return x.includes(y.slice(0, 8)) || y.includes(x.slice(0, 8));
}

function persistDeletedLabs(set: Set<string>) {
  deletedLabKeys = set;
  try {
    fs.mkdirSync(path.dirname(DELETED_LABS_PATH), { recursive: true });
    fs.writeFileSync(DELETED_LABS_PATH, JSON.stringify([...set], null, 2));
  } catch (err) {
    console.warn("[lab-portfolio] could not persist deleted labs:", err);
  }
}

function rememberDeletedLab(labName: string) {
  const set = loadDeletedLabs();
  const key = norm(labName);
  if (!key || set.has(key)) return;
  set.add(key);
  persistDeletedLabs(set);
  rememberDeletedMaster({ labName });
}

export function isLabDeleted(labName: string | null | undefined): boolean {
  const key = norm(labName);
  return Boolean(key && loadDeletedLabs().has(key));
}

/** 제안서/상품 재등록 시 삭제 목록에서 복구 */
export function restoreDeletedLab(
  labName: string,
  extras?: { siteAddress?: string | null; siteName?: string | null }
) {
  const set = loadDeletedLabs();
  const key = norm(labName);
  if (key && set.has(key)) {
    set.delete(key);
    persistDeletedLabs(set);
  } else {
    // 파일은 이미 비워진 경우에도 메모리 캐시를 파일과 동기화
    try {
      if (fs.existsSync(DELETED_LABS_PATH)) {
        const raw = JSON.parse(fs.readFileSync(DELETED_LABS_PATH, "utf8")) as string[];
        deletedLabKeys = new Set(raw);
      } else {
        deletedLabKeys = new Set();
      }
    } catch {
      deletedLabKeys = new Set();
    }
  }
  restoreDeletedMaster({
    labName,
    siteAddress: extras?.siteAddress,
    siteName: extras?.siteName,
  });
}

function applyDeletedFilter(funds: LabFund[]): LabFund[] {
  const set = loadDeletedLabs();
  if (set.size === 0) return funds;
  return funds.filter((f) => !set.has(norm(f.name)));
}

function trySeedFromSample() {
  if (seeded || snapshot) return;
  seeded = true;

  try {
    if (fs.existsSync(PERSIST_PATH)) {
      const raw = JSON.parse(fs.readFileSync(PERSIST_PATH, "utf8")) as LabPortfolioSnapshot;
      if (raw?.funds?.length) {
        // 삭제 필터는 get 시점에만 적용 (재등록 복구를 위해 원본 유지)
        snapshot = { ...raw, funds: raw.funds, stats: recomputeStats(raw.funds) };
        return;
      }
    }
  } catch (err) {
    console.warn("[lab-portfolio] persist load failed:", err);
  }

  try {
    const samplePath = path.join(process.cwd(), "samples", "부동산랩현황.xlsx");
    if (!fs.existsSync(samplePath)) return;
    const buffer = fs.readFileSync(samplePath);
    const parsed = parseLabStatusExcel(buffer, "부동산랩현황.xlsx");
    snapshot = {
      ...parsed,
      funds: parsed.funds,
      stats: recomputeStats(parsed.funds),
    };
    persistSnapshot();
  } catch (err) {
    console.warn("[lab-portfolio] sample seed failed:", err);
  }
}

function normalizeFund(f: LabFund): LabFund {
  return {
    ...f,
    interestRate: normalizeRateValue(f.interestRate),
    feeRate: normalizeRateValue(f.feeRate),
    trustCompany: f.trustCompany ?? null,
    landArea: f.landArea ?? null,
    buildingArea: f.buildingArea ?? null,
    totalFloorArea: f.totalFloorArea ?? null,
    buildingScale: f.buildingScale ?? null,
    householdCount: f.householdCount ?? null,
    developer: f.developer ?? null,
    contractor: f.contractor ?? null,
    progressComment: f.progressComment ?? null,
    interestPayments: f.interestPayments ?? [],
  };
}

/** 제안서에서 추출한 조건으로 랩 현황(마스터)에 신규/갱신 */
export function upsertLabFundFromProposal(input: {
  labName: string;
  fundName?: string | null;
  siteAddress?: string | null;
  businessDesc?: string | null;
  setupAmount?: number | null;
  notes?: string | null;
  setupDate?: string | null;
  maturityDate?: string | null;
  loanMaturityDate?: string | null;
  interestRate?: string | number | null;
  feeRate?: string | number | null;
  purchaseAgency?: string | null;
  developer?: string | null;
  contractor?: string | null;
  trustCompany?: string | null;
  trustType?: string | null;
  landArea?: string | null;
  buildingArea?: string | null;
  totalFloorArea?: string | null;
  buildingScale?: string | null;
  householdCount?: string | null;
}): LabFund {
  trySeedFromSample();
  // 예전에 삭제됐던 랩을 다시 등록하면 삭제 이력을 해제해야 사업장관리에 보임
  restoreDeletedLab(input.labName, {
    siteAddress: input.siteAddress,
    siteName: input.businessDesc,
  });

  const funds = snapshot ? [...snapshot.funds] : [];
  const labNum = input.labName.match(/(\d{1,3})\s*호/)?.[1] ?? null;
  const idx = funds.findIndex((f) => {
    if (norm(f.name) === norm(input.labName) || f.name === input.labName) return true;
    if (labNum) {
      const n = f.name.match(/(\d{1,3})\s*호/)?.[1];
      return n === labNum;
    }
    return false;
  });

  if (idx >= 0) {
    funds[idx] = normalizeFund({
      ...funds[idx],
      fundName: input.fundName ?? funds[idx].fundName,
      siteAddress: input.siteAddress ?? funds[idx].siteAddress,
      businessDesc: input.businessDesc ?? funds[idx].businessDesc,
      setupAmount: input.setupAmount ?? funds[idx].setupAmount,
      balance: funds[idx].balance ?? input.setupAmount ?? null,
      note: input.notes ?? funds[idx].note,
      setupDate: input.setupDate ?? funds[idx].setupDate,
      maturityDate: input.maturityDate ?? funds[idx].maturityDate,
      loanMaturityDate: input.loanMaturityDate ?? funds[idx].loanMaturityDate,
      interestRate:
        input.interestRate != null
          ? normalizeRateValue(input.interestRate)
          : funds[idx].interestRate,
      feeRate:
        input.feeRate != null
          ? normalizeRateValue(input.feeRate)
          : funds[idx].feeRate,
      purchaseAgency: input.purchaseAgency ?? funds[idx].purchaseAgency,
      developer: input.developer ?? funds[idx].developer,
      contractor: input.contractor ?? funds[idx].contractor,
      trustCompany: input.trustCompany ?? funds[idx].trustCompany,
      trustType: input.trustType ?? funds[idx].trustType,
      landArea: input.landArea ?? funds[idx].landArea,
      buildingArea: input.buildingArea ?? funds[idx].buildingArea,
      totalFloorArea: input.totalFloorArea ?? funds[idx].totalFloorArea,
      buildingScale: input.buildingScale ?? funds[idx].buildingScale,
      householdCount: input.householdCount ?? funds[idx].householdCount,
    });
  } else {
    funds.push(
      normalizeFund({
        id: `lab-proposal-${crypto.randomUUID()}`,
        name: input.labName,
        productCode: null,
        fundName: input.fundName ?? null,
        fundCode: null,
        purchaseAgency: input.purchaseAgency ?? null,
        setupDate: input.setupDate ?? null,
        maturityDate: input.maturityDate ?? null,
        loanMaturityDate: input.loanMaturityDate ?? null,
        repaymentDate: null,
        setupAmount: input.setupAmount ?? null,
        balance: input.setupAmount ?? null,
        interestRate: normalizeRateValue(input.interestRate),
        feeRate: normalizeRateValue(input.feeRate),
        trustType: input.trustType ?? null,
        trustCompany: input.trustCompany ?? null,
        siteAddress: input.siteAddress ?? null,
        businessDesc: input.businessDesc ?? null,
        developer: input.developer ?? null,
        contractor: input.contractor ?? null,
        landArea: input.landArea ?? null,
        buildingArea: input.buildingArea ?? null,
        totalFloorArea: input.totalFloorArea ?? null,
        buildingScale: input.buildingScale ?? null,
        householdCount: input.householdCount ?? null,
        plannedProgressPct: null,
        actualProgressPct: null,
        vsPlan: null,
        note: input.notes ?? null,
        progressComment: null,
        interestPayments: [],
        status: "active",
      })
    );
  }

  commit(funds, snapshot?.fileName ?? "제안서 반영");
  return funds[idx >= 0 ? idx : funds.length - 1];
}

export function getLabPortfolio(): LabPortfolioSnapshot | null {
  trySeedFromSample();
  if (!snapshot) return null;
  const funds = applyDeletedFilter(snapshot.funds).map(normalizeFund);
  return {
    ...snapshot,
    funds,
    stats: recomputeStats(funds),
  };
}

export function setLabPortfolio(next: LabPortfolioSnapshot): LabPortfolioSnapshot {
  const funds = applyDeletedFilter(next.funds);
  return commit(funds, next.fileName);
}

export function updateLabFundProgressComment(
  fundId: string,
  progressComment: string
): LabFund | null {
  return updateLabFund(fundId, { progressComment: progressComment.trim() || null });
}

export function updateLabFund(
  fundId: string,
  patch: Partial<LabFund>
): LabFund | null {
  trySeedFromSample();
  if (!snapshot) return null;
  const idx = snapshot.funds.findIndex((f) => f.id === fundId);
  if (idx < 0) return null;

  const prev = snapshot.funds[idx];
  const next: LabFund = {
    ...prev,
    ...patch,
    id: prev.id,
    interestPayments: patch.interestPayments ?? prev.interestPayments ?? [],
  };

  if (patch.balance !== undefined || patch.repaymentDate !== undefined) {
    if (next.repaymentDate || (next.balance != null && next.balance <= 0)) {
      next.status = "repaid";
    } else if (next.status === "repaid" && (next.balance == null || next.balance > 0)) {
      next.status = "active";
    }
  }

  const funds = [...snapshot.funds];
  funds[idx] = next;
  commit(funds);
  return next;
}

export function deleteLabFundById(fundId: string): LabFund | null {
  trySeedFromSample();
  if (!snapshot) return null;
  const idx = snapshot.funds.findIndex((f) => f.id === fundId);
  if (idx < 0) return null;
  const removed = snapshot.funds[idx];
  const funds = snapshot.funds.filter((f) => f.id !== fundId);
  rememberDeletedLab(removed.name);
  commit(funds);
  return removed;
}

/** 상품/사업장 삭제 시 전체현황에서도 제거 */
export function removeLabFundsMatching(criteria: {
  labName?: string | null;
  fundName?: string | null;
  siteAddress?: string | null;
  siteName?: string | null;
}): { removed: number; names: string[] } {
  trySeedFromSample();
  if (!snapshot) return { removed: 0, names: [] };

  const lab = norm(criteria.labName);
  const fund = norm(criteria.fundName);
  const siteName = norm(criteria.siteName);
  const names: string[] = [];

  const funds = snapshot.funds.filter((f) => {
    const hit =
      (lab && norm(f.name) === lab) ||
      (lab && lab.length >= 4 && norm(f.name).includes(lab)) ||
      (fund && fund.length >= 4 && norm(f.fundName).includes(fund)) ||
      (criteria.siteAddress &&
        f.siteAddress &&
        addrOverlap(criteria.siteAddress, f.siteAddress)) ||
      (siteName &&
        siteName.length >= 2 &&
        (norm(f.businessDesc).includes(siteName) || norm(f.name).includes(siteName)));
    if (hit) names.push(f.name);
    return !hit;
  });

  if (names.length === 0) return { removed: 0, names: [] };

  for (const n of names) rememberDeletedLab(n);
  commit(funds, snapshot.fileName ?? "삭제 반영");
  return { removed: names.length, names };
}

export function normalizeInterestPayments(
  payments: Array<{ round?: number; date?: string | null; raw?: string | null }>
): LabInterestPayment[] {
  return payments
    .map((p, i) => ({
      round: Number(p.round ?? i + 1),
      date: String(p.date ?? "").trim(),
      raw: p.raw?.trim() || undefined,
    }))
    .filter((p) => p.date && Number.isFinite(p.round))
    .sort((a, b) => a.round - b.round);
}
