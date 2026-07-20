import fs from "fs";
import path from "path";
import { parseGisungReport } from "@/lib/analyzers/gisung-progress";
import { getLabPortfolio } from "@/lib/data/lab-portfolio";
import {
  isLabProgressDbConfigured,
  labProgressRowId,
  pickLatestPerLab,
  sbGetLabProgressByLabAndDate,
  sbGetLatestLabProgressByLabName,
  sbListAllLabProgress,
  sbListLabProgress,
  sbUpsertLabProgress,
} from "@/lib/data/supabase-lab-progress";
import {
  decideAutoMatch,
  matchPortfolio,
  type PortfolioFundRow,
} from "@/lib/progress/match-portfolio";
import type { GisungExtracted } from "@/lib/progress/types";
import type {
  LabFund,
  LabProgressApplyResult,
  LabProgressMatchCandidate,
  LabProgressRow,
  MissingProgressLab,
} from "@/lib/types";

const PERSIST_PATH = path.join(process.cwd(), ".data", "lab-progress.json");

let localCache: LabProgressRow[] | null = null;

function loadLocal(): LabProgressRow[] {
  if (localCache) return localCache;
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      localCache = JSON.parse(fs.readFileSync(PERSIST_PATH, "utf8")) as LabProgressRow[];
      return localCache;
    }
  } catch (err) {
    console.warn("[lab-progress] local load failed:", err);
  }
  localCache = [];
  return localCache;
}

function saveLocal(rows: LabProgressRow[]) {
  localCache = rows;
  try {
    fs.mkdirSync(path.dirname(PERSIST_PATH), { recursive: true });
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(rows, null, 2));
  } catch (err) {
    console.warn("[lab-progress] local persist failed:", err);
  }
}

function compareDate(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.localeCompare(b);
}

function fundsToMatchRows(funds: LabFund[]): PortfolioFundRow[] {
  return funds.map((f) => ({
    name: f.name,
    fund_name: f.fundName,
    fund_code: f.fundCode,
    site_address: f.siteAddress,
    status: f.status,
    planned_progress_pct: f.plannedProgressPct,
    actual_progress_pct: f.actualProgressPct,
    developer: f.developer,
    contractor: f.contractor,
    trust_company: f.trustCompany,
    business_desc: f.businessDesc,
  }));
}

function buildRowFromExtract(
  extracted: GisungExtracted,
  match: {
    labName: string;
    fundName: string | null;
    siteAddress: string | null;
    labFundId: string | null;
  },
  documentId: string | null
): LabProgressRow {
  const id = labProgressRowId(match.labFundId, match.labName, extracted.reportDate);
  return {
    id,
    labFundId: match.labFundId,
    labName: match.labName,
    fundName: match.fundName,
    siteAddress: match.siteAddress ?? extracted.siteAddress,
    plannedProgressPct: extracted.plannedProgressPct,
    actualProgressPct: extracted.actualProgressPct,
    achievementPct: extracted.achievementPct,
    delayDays: extracted.delayDays,
    confirmedDate: extracted.reportDate,
    specialNotes: extracted.specialNotesSummary,
    sourceFileName: extracted.fileName,
    documentId,
    updatedAt: new Date().toISOString(),
  };
}

async function getLatestByLabName(labName: string): Promise<LabProgressRow | null> {
  if (isLabProgressDbConfigured()) {
    try {
      return await sbGetLatestLabProgressByLabName(labName);
    } catch (err) {
      console.warn("[lab-progress] supabase get latest failed, local fallback:", err);
    }
  }
  const rows = loadLocal().filter((r) => r.labName === labName);
  return pickLatestPerLab(rows)[0] ?? null;
}

async function getByLabAndDate(
  labName: string,
  confirmedDate: string | null
): Promise<LabProgressRow | null> {
  if (!confirmedDate) return null;
  if (isLabProgressDbConfigured()) {
    try {
      return await sbGetLabProgressByLabAndDate(labName, confirmedDate);
    } catch (err) {
      console.warn("[lab-progress] supabase get by date failed, local fallback:", err);
    }
  }
  return (
    loadLocal().find(
      (r) => r.labName === labName && r.confirmedDate === confirmedDate
    ) ?? null
  );
}

async function persistRow(row: LabProgressRow): Promise<LabProgressRow> {
  if (isLabProgressDbConfigured()) {
    try {
      const saved = await sbUpsertLabProgress(row);
      const local = loadLocal().filter((r) => r.id !== saved.id);
      local.push(saved);
      saveLocal(local);
      return saved;
    } catch (err) {
      console.warn("[lab-progress] supabase upsert failed, local only:", err);
    }
  }
  const local = loadLocal().filter((r) => r.id !== row.id);
  local.push(row);
  saveLocal(local);
  return row;
}

async function loadAllProgressRows(): Promise<LabProgressRow[]> {
  if (isLabProgressDbConfigured()) {
    try {
      return await sbListAllLabProgress();
    } catch (err) {
      console.warn("[lab-progress] supabase list all failed, local fallback:", err);
    }
  }
  return loadLocal();
}

export async function listLabProgress(): Promise<LabProgressRow[]> {
  if (isLabProgressDbConfigured()) {
    try {
      const rows = await sbListLabProgress();
      saveLocal(await sbListAllLabProgress());
      return rows;
    } catch (err) {
      console.warn("[lab-progress] supabase list failed, local fallback:", err);
    }
  }
  return pickLatestPerLab(loadLocal()).sort((a, b) =>
    b.labName.localeCompare(a.labName, "ko", { numeric: true })
  );
}

/** 랩별 공정 이력 (확인일 내림차순) */
export async function listLabProgressHistory(
  labName?: string
): Promise<LabProgressRow[]> {
  const all = await loadAllProgressRows();
  const filtered = labName ? all.filter((r) => r.labName === labName) : all;
  return filtered.sort((a, b) => {
    const d = compareDate(b.confirmedDate, a.confirmedDate);
    if (d !== 0) return d;
    return b.labName.localeCompare(a.labName, "ko", { numeric: true });
  });
}

function monthPrefix(isoMonth: string): string {
  return isoMonth.slice(0, 7);
}

function currentMonthPrefix(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** active 랩 중 지정 월(YYYY-MM)에 confirmed_date 보고가 없는 랩 */
export async function listLabsMissingProgressForMonth(
  month: string = currentMonthPrefix()
): Promise<MissingProgressLab[]> {
  const portfolio = await getLabPortfolio();
  const funds = (portfolio?.funds ?? []).filter((f) => f.status === "active");
  const all = await loadAllProgressRows();
  const monthRows = all.filter(
    (r) => r.confirmedDate && monthPrefix(r.confirmedDate) === month
  );

  const reportedByFundId = new Set(
    monthRows.map((r) => r.labFundId).filter(Boolean) as string[]
  );
  const reportedByLabName = new Set(
    monthRows.map((r) => r.labName.replace(/\s+/g, "").toLowerCase())
  );

  const latestByLab = new Map<string, LabProgressRow>();
  for (const row of pickLatestPerLab(all)) {
    latestByLab.set(row.labName.replace(/\s+/g, "").toLowerCase(), row);
  }

  const missing: MissingProgressLab[] = [];
  for (const fund of funds) {
    const labKey = fund.name.replace(/\s+/g, "").toLowerCase();
    const reported =
      reportedByFundId.has(fund.id) || reportedByLabName.has(labKey);
    if (reported) continue;
    const latest = latestByLab.get(labKey);
    missing.push({
      labFundId: fund.id,
      labName: fund.name,
      fundName: fund.fundName,
      siteAddress: fund.siteAddress,
      lastConfirmedDate: latest?.confirmedDate ?? null,
    });
  }

  return missing.sort((a, b) =>
    b.labName.localeCompare(a.labName, "ko", { numeric: true })
  );
}

export async function updateLabProgressFields(
  id: string,
  patch: Partial<
    Pick<
      LabProgressRow,
      | "labName"
      | "fundName"
      | "siteAddress"
      | "plannedProgressPct"
      | "actualProgressPct"
      | "achievementPct"
      | "delayDays"
      | "confirmedDate"
      | "specialNotes"
    >
  >
): Promise<LabProgressRow | null> {
  const rows = await listLabProgress();
  const prev = rows.find((r) => r.id === id);
  if (!prev) return null;

  const next: LabProgressRow = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const saved = await persistRow(next);
  return saved;
}

export async function deleteLabProgress(id: string): Promise<boolean> {
  const rows = await listLabProgress();
  const exists = rows.some((r) => r.id === id);
  if (!exists) return false;

  if (isLabProgressDbConfigured()) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const client = createAdminClient();
      if (client) {
        const { error } = await client.from("lab_progress").delete().eq("id", id);
        if (error) throw error;
      }
    } catch (err) {
      console.warn("[lab-progress] supabase delete failed:", err);
    }
  }

  saveLocal(loadLocal().filter((r) => r.id !== id));
  return true;
}

function mergeSpecialNotes(
  existing: string | null | undefined,
  incoming: string | null | undefined
): string | null {
  const a = (existing ?? "").trim();
  const b = (incoming ?? "").trim();
  if (!a) return b || null;
  if (!b) return a || null;
  if (a.includes(b) || b.includes(a)) return a.length >= b.length ? a : b;
  // 필증 메모가 앞에 오도록
  if (/필증/.test(b) && !/필증/.test(a)) return `${b} / ${a}`;
  if (/필증/.test(a) && !/필증/.test(b)) return `${a} / ${b}`;
  return `${a} / ${b}`;
}

function isPermitOnlyRow(row: LabProgressRow): boolean {
  return (
    row.actualProgressPct == null &&
    row.plannedProgressPct == null &&
    Boolean(row.specialNotes && /필증/.test(row.specialNotes))
  );
}

export async function applyLabProgressRow(
  row: LabProgressRow,
  options?: { force?: boolean }
): Promise<LabProgressApplyResult> {
  const latest = await getLatestByLabName(row.labName);
  const sameDate = row.confirmedDate
    ? await getByLabAndDate(row.labName, row.confirmedDate)
    : null;
  const force = options?.force === true;

  let toSave = row;

  // 필증만 올린 경우: 동일 확인일 또는 최신 행에 특이사항 병합
  if (isPermitOnlyRow(row)) {
    const target = sameDate ?? latest;
    if (target) {
      toSave = {
        ...target,
        specialNotes: mergeSpecialNotes(target.specialNotes, row.specialNotes),
        confirmedDate: row.confirmedDate ?? target.confirmedDate,
        sourceFileName: row.sourceFileName ?? target.sourceFileName,
        documentId: row.documentId ?? target.documentId,
        updatedAt: new Date().toISOString(),
      };
    }
  } else if (sameDate) {
    // 동일 확인일 재업로드 → 해당 스냅샷 갱신
    toSave = {
      ...row,
      id: sameDate.id,
      specialNotes: mergeSpecialNotes(row.specialNotes, sameDate.specialNotes),
    };
  } else if (latest && !force && row.confirmedDate) {
    const cmp = compareDate(row.confirmedDate, latest.confirmedDate);
    if (cmp < 0) {
      return {
        action: "stale",
        message: `현재자료가 더 최신자료입니다. (보관 ${latest.confirmedDate ?? "—"} / 업로드 ${row.confirmedDate ?? "—"}) 업데이트 할까요?`,
        row,
        existing: latest,
      };
    }
    if (latest.specialNotes && /필증/.test(latest.specialNotes)) {
      toSave = {
        ...row,
        specialNotes: mergeSpecialNotes(row.specialNotes, latest.specialNotes),
      };
    }
  } else if (latest?.specialNotes && /필증/.test(latest.specialNotes) && !sameDate) {
    toSave = {
      ...row,
      specialNotes: mergeSpecialNotes(row.specialNotes, latest.specialNotes),
    };
  }

  const saved = await persistRow(toSave);
  const isNewSnapshot = !sameDate && !latest;
  const isUpdatedSnapshot = Boolean(sameDate || (latest && !isNewSnapshot));
  return {
    action: isNewSnapshot ? "created" : isUpdatedSnapshot ? "updated" : "created",
    message: isPermitOnlyRow(row)
      ? `${saved.labName} 특이사항에 필증 정보를 반영했습니다.`
      : sameDate
        ? `${saved.labName} ${saved.confirmedDate ?? ""} 공정율을 갱신했습니다.`
        : latest
          ? `${saved.labName} 공정율 이력을 추가했습니다. (${saved.confirmedDate ?? "—"})`
          : `${saved.labName} 공정율을 등록했습니다.`,
    row: saved,
    existing: latest,
  };
}

/** 미매칭 추출 결과를 선택한 랩에 붙여 저장 */
export async function bindLabProgressToFund(params: {
  row: LabProgressRow;
  labFundId: string;
  force?: boolean;
}): Promise<LabProgressApplyResult> {
  const portfolio = await getLabPortfolio();
  const fund = portfolio?.funds.find((f) => f.id === params.labFundId);
  if (!fund) {
    return {
      action: "unmatched",
      message: "선택한 부동산랩을 찾지 못했습니다.",
      row: params.row,
      existing: null,
    };
  }

  const bound: LabProgressRow = {
    ...params.row,
    id: labProgressRowId(fund.id, fund.name, params.row.confirmedDate),
    labFundId: fund.id,
    labName: fund.name,
    fundName: fund.fundName,
    siteAddress: fund.siteAddress ?? params.row.siteAddress,
    updatedAt: new Date().toISOString(),
  };

  return applyLabProgressRow(bound, { force: params.force === true });
}

/** PDF 텍스트 → 포트폴리오 매칭 → 저장(또는 stale/unmatched 확인) */
export async function ingestGisungProgress(params: {
  pdfText: string;
  fileName: string;
  documentId: string;
  force?: boolean;
  labFundId?: string | null;
}): Promise<LabProgressApplyResult> {
  const extracted = parseGisungReport(params.pdfText, params.fileName);
  const portfolio = await getLabPortfolio();
  const funds = portfolio?.funds ?? [];

  if (params.labFundId) {
    const fund = funds.find((f) => f.id === params.labFundId);
    if (!fund) {
      return {
        action: "unmatched",
        message: "지정한 부동산랩을 찾지 못했습니다.",
        row: null,
        existing: null,
      };
    }
    const row = buildRowFromExtract(
      extracted,
      {
        labName: fund.name,
        fundName: fund.fundName,
        siteAddress: fund.siteAddress,
        labFundId: fund.id,
      },
      params.documentId
    );
    return applyLabProgressRow(row, { force: params.force });
  }

  const fundRows = fundsToMatchRows(funds);
  const candidates = matchPortfolio(extracted, fundRows);
  const decision = decideAutoMatch(candidates, fundRows, {
    extractedAddress: extracted.siteAddress,
    multiFundHints: extracted.fundRoundHints,
    fundNameHint: extracted.fundNameHint,
    operatorHints: extracted.operatorHints,
  });

  const toMatchCandidates = (
    list: typeof candidates
  ): LabProgressMatchCandidate[] =>
    list.slice(0, 8).map((c) => ({
      labName: c.labName,
      fundName: c.fundName,
      siteAddress: c.siteAddress,
      score: c.score,
    }));

  // 동일사업장·저신뢰·복수호수 등은 절대 자동저장하지 않고 확인 큐로
  if (decision.needsConfirmation || !decision.match) {
    let preferred =
      decision.sharedSiteGroup.length > 0
        ? decision.sharedSiteGroup
        : candidates;
    if (decision.suggested) {
      preferred = [
        decision.suggested,
        ...preferred.filter((c) => c.labName !== decision.suggested!.labName),
      ];
    }
    return {
      action: "unmatched",
      message:
        decision.reason ??
        (candidates.length > 0
          ? `자동 매칭 신뢰도가 낮습니다. 후보 ${candidates.length}건 중 기존 부동산랩을 선택해 주세요.`
          : "사업장 주소로 자동 매칭되지 않았습니다. 아래 목록에서 기존 부동산랩을 선택해 주세요."),
      row: buildRowFromExtract(
        extracted,
        {
          labName:
            decision.suggested?.labName ??
            extracted.projectName ??
            extracted.fileName,
          fundName: decision.suggested?.fundName ?? null,
          siteAddress:
            decision.suggested?.siteAddress ?? extracted.siteAddress,
          labFundId: null,
        },
        params.documentId
      ),
      existing: null,
      matchCandidates: toMatchCandidates(preferred),
      needsConfirmation: true,
      suggestedLabName: decision.suggested?.labName ?? null,
    };
  }

  const top = decision.match;
  const matchedFund = funds.find((f) => f.name === top.labName);
  const row = buildRowFromExtract(
    extracted,
    {
      labName: top.labName,
      fundName: top.fundName,
      siteAddress: top.siteAddress,
      labFundId: matchedFund?.id ?? null,
    },
    params.documentId
  );

  return applyLabProgressRow(row, { force: params.force });
}
