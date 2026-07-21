import fs from "fs";
import path from "path";
import { parseLabStatusExcel } from "@/lib/analyzers/lab-status-excel";
import {
  rememberDeletedMaster,
  restoreDeletedMaster,
} from "@/lib/data/deleted-masters";
import {
  isLabPortfolioDbConfigured,
  sbDeleteLabFund,
  sbGetLabPortfolio,
  sbListAllLabFundsRaw,
  sbRememberDeletedName,
  sbReplaceLabPortfolio,
  sbRestoreDeletedName,
  sbUpsertLabFund,
} from "@/lib/data/supabase-lab-portfolio";
import {
  deriveLabFundStatus,
  normalizeRateValue,
} from "@/lib/lab/portfolio-ui";
import type { LabFund, LabInterestPayment, LabPortfolioSnapshot } from "@/lib/types";

const PERSIST_PATH = path.join(process.cwd(), ".data", "lab-portfolio.json");
const DELETED_LABS_PATH = path.join(process.cwd(), ".data", "deleted-labs.json");

let snapshot: LabPortfolioSnapshot | null = null;
let seeded = false;
let deletedLabKeys: Set<string> | null = null;

function recomputeStats(funds: LabFund[]): LabPortfolioSnapshot["stats"] {
  const activeCount = funds.filter((f) => f.status === "active").length;
  const repaidCount = funds.filter((f) => f.status === "repaid").length;
  return {
    totalCount: funds.length,
    activeCount,
    repaidCount,
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

function commitLocal(funds: LabFund[], fileName?: string): LabPortfolioSnapshot {
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

function rememberDeletedLabLocal(labName: string) {
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

export async function restoreDeletedLab(
  labName: string,
  extras?: { siteAddress?: string | null; siteName?: string | null }
) {
  if (isLabPortfolioDbConfigured()) {
    try {
      await sbRestoreDeletedName(labName);
    } catch (err) {
      console.warn("[lab-portfolio] supabase restore deleted failed:", err);
    }
  }

  const set = loadDeletedLabs();
  const key = norm(labName);
  if (key && set.has(key)) {
    set.delete(key);
    persistDeletedLabs(set);
  } else {
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
  const next = {
    ...f,
    earlyRepaymentDate: f.earlyRepaymentDate ?? null,
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
  return {
    ...next,
    status: deriveLabFundStatus(next),
  };
}

function getLocalPortfolio(): LabPortfolioSnapshot | null {
  trySeedFromSample();
  if (!snapshot) return null;
  const funds = applyDeletedFilter(snapshot.funds).map(normalizeFund);
  return {
    ...snapshot,
    funds,
    stats: recomputeStats(funds),
  };
}

/** 로컬 `.data` 파일 원본 (이관용) */
export function readLocalLabPortfolioFile(): LabPortfolioSnapshot | null {
  try {
    if (!fs.existsSync(PERSIST_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(PERSIST_PATH, "utf8")) as LabPortfolioSnapshot;
    if (!raw?.funds?.length) return null;
    return {
      ...raw,
      funds: raw.funds.map(normalizeFund),
      stats: recomputeStats(raw.funds),
    };
  } catch {
    return null;
  }
}

export async function getLabPortfolio(): Promise<LabPortfolioSnapshot | null> {
  if (isLabPortfolioDbConfigured()) {
    try {
      const fromDb = await sbGetLabPortfolio();
      if (fromDb && fromDb.funds.length > 0) {
        const funds = fromDb.funds.map(normalizeFund);
        const normalized = {
          ...fromDb,
          funds,
          stats: recomputeStats(funds),
        };
        snapshot = normalized;
        return normalized;
      }
    } catch (err) {
      console.warn("[lab-portfolio] supabase get failed, using local:", err);
    }
  }
  return getLocalPortfolio();
}

export async function setLabPortfolio(
  next: LabPortfolioSnapshot
): Promise<LabPortfolioSnapshot> {
  const funds = applyDeletedFilter(next.funds).map(normalizeFund);
  const committed: LabPortfolioSnapshot = {
    uploadedAt: next.uploadedAt || new Date().toISOString(),
    fileName: next.fileName || "수동 편집",
    funds,
    stats: recomputeStats(funds),
  };

  if (isLabPortfolioDbConfigured()) {
    try {
      const saved = await sbReplaceLabPortfolio(committed);
      snapshot = saved;
      persistSnapshot();
      return saved;
    } catch (err) {
      console.warn("[lab-portfolio] supabase set failed, using local:", err);
    }
  }

  snapshot = committed;
  persistSnapshot();
  return committed;
}

export async function updateLabFund(
  fundId: string,
  patch: Partial<LabFund>
): Promise<LabFund | null> {
  const portfolio = await getLabPortfolio();
  if (!portfolio) return null;
  const idx = portfolio.funds.findIndex((f) => f.id === fundId);
  if (idx < 0) return null;

  const prev = portfolio.funds[idx];
  const next: LabFund = normalizeFund({
    ...prev,
    ...patch,
    id: prev.id,
    interestPayments: patch.interestPayments ?? prev.interestPayments ?? [],
  });

  if (patch.balance !== undefined || patch.repaymentDate !== undefined) {
    if (next.repaymentDate || (next.balance != null && next.balance <= 0)) {
      next.status = "repaid";
    } else if (next.status === "repaid" && (next.balance == null || next.balance > 0)) {
      next.status = "active";
    }
  }

  if (isLabPortfolioDbConfigured()) {
    try {
      await sbUpsertLabFund(next);
      const funds = [...portfolio.funds];
      funds[idx] = next;
      snapshot = {
        ...portfolio,
        funds,
        stats: recomputeStats(funds),
        uploadedAt: new Date().toISOString(),
      };
      persistSnapshot();
      return next;
    } catch (err) {
      console.warn("[lab-portfolio] supabase update failed, using local:", err);
    }
  }

  trySeedFromSample();
  if (!snapshot) return null;
  const localIdx = snapshot.funds.findIndex((f) => f.id === fundId);
  if (localIdx < 0) return null;
  const funds = [...snapshot.funds];
  funds[localIdx] = next;
  commitLocal(funds);
  return next;
}

export async function updateLabFundProgressComment(
  fundId: string,
  progressComment: string
): Promise<LabFund | null> {
  return updateLabFund(fundId, { progressComment: progressComment.trim() || null });
}

export async function deleteLabFundById(fundId: string): Promise<LabFund | null> {
  if (isLabPortfolioDbConfigured()) {
    try {
      const removed = await sbDeleteLabFund(fundId);
      if (removed) {
        await sbRememberDeletedName(removed.name);
        rememberDeletedMaster({ labName: removed.name });
        rememberDeletedLabLocal(removed.name);
        const portfolio = await sbGetLabPortfolio();
        snapshot = portfolio;
        if (portfolio) persistSnapshot();
        return removed;
      }
    } catch (err) {
      console.warn("[lab-portfolio] supabase delete failed, using local:", err);
    }
  }

  trySeedFromSample();
  if (!snapshot) return null;
  const idx = snapshot.funds.findIndex((f) => f.id === fundId);
  if (idx < 0) return null;
  const removed = snapshot.funds[idx];
  const funds = snapshot.funds.filter((f) => f.id !== fundId);
  rememberDeletedLabLocal(removed.name);
  commitLocal(funds);
  return removed;
}

export async function upsertLabFundFromProposal(input: {
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
}): Promise<LabFund> {
  await restoreDeletedLab(input.labName, {
    siteAddress: input.siteAddress,
    siteName: input.businessDesc,
  });

  const portfolio = (await getLabPortfolio()) ?? {
    uploadedAt: new Date().toISOString(),
    fileName: "제안서 반영",
    funds: [],
    stats: recomputeStats([]),
  };
  const funds = [...portfolio.funds];
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
        earlyRepaymentDate: null,
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

  const saved = await setLabPortfolio({
    ...portfolio,
    fileName: portfolio.fileName || "제안서 반영",
    funds,
  });
  return funds[idx >= 0 ? idx : funds.length - 1] ?? saved.funds[saved.funds.length - 1];
}

export async function removeLabFundsMatching(criteria: {
  labName?: string | null;
  fundName?: string | null;
  siteAddress?: string | null;
  siteName?: string | null;
}): Promise<{ removed: number; names: string[] }> {
  const portfolio = await getLabPortfolio();
  if (!portfolio) return { removed: 0, names: [] };

  const lab = norm(criteria.labName);
  const fund = norm(criteria.fundName);
  const siteName = norm(criteria.siteName);
  const names: string[] = [];

  const funds = portfolio.funds.filter((f) => {
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

  for (const n of names) {
    rememberDeletedLabLocal(n);
    if (isLabPortfolioDbConfigured()) {
      try {
        await sbRememberDeletedName(n);
      } catch (err) {
        console.warn("[lab-portfolio] supabase remember deleted failed:", err);
      }
    }
  }

  await setLabPortfolio({
    ...portfolio,
    fileName: portfolio.fileName ?? "삭제 반영",
    funds,
  });
  return { removed: names.length, names };
}

/** 로컬 `.data` → Supabase 일괄 이관 */
export async function migrateLocalPortfolioToSupabase(): Promise<{
  ok: boolean;
  count: number;
  fileName: string;
  message: string;
}> {
  if (!isLabPortfolioDbConfigured()) {
    return {
      ok: false,
      count: 0,
      fileName: "",
      message: "Supabase가 설정되지 않았습니다.",
    };
  }

  const local = readLocalLabPortfolioFile();
  if (!local?.funds.length) {
    return {
      ok: false,
      count: 0,
      fileName: "",
      message: "로컬 .data/lab-portfolio.json 이 없거나 비어 있습니다.",
    };
  }

  const deleted = loadDeletedLabs();
  for (const key of deleted) {
    await sbRememberDeletedName(key);
  }

  const saved = await sbReplaceLabPortfolio(local);
  snapshot = saved;
  return {
    ok: true,
    count: saved.funds.length,
    fileName: saved.fileName,
    message: `${saved.funds.length}건을 Supabase로 이관했습니다.`,
  };
}

export async function countSupabaseLabFunds(): Promise<number> {
  if (!isLabPortfolioDbConfigured()) return 0;
  try {
    const funds = await sbListAllLabFundsRaw();
    return funds.length;
  } catch {
    return 0;
  }
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
