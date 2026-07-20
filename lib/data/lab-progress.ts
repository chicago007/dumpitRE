import fs from "fs";
import path from "path";
import { parseGisungReport } from "@/lib/analyzers/gisung-progress";
import { getLabPortfolio } from "@/lib/data/lab-portfolio";
import {
  isLabProgressDbConfigured,
  sbGetLabProgressByLabName,
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
  const id = match.labFundId ?? `lab-progress-${match.labName.replace(/\s+/g, "")}`;
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

async function getExistingByLabName(labName: string): Promise<LabProgressRow | null> {
  if (isLabProgressDbConfigured()) {
    try {
      return await sbGetLabProgressByLabName(labName);
    } catch (err) {
      console.warn("[lab-progress] supabase get failed, local fallback:", err);
    }
  }
  return loadLocal().find((r) => r.labName === labName) ?? null;
}

async function persistRow(row: LabProgressRow): Promise<LabProgressRow> {
  if (isLabProgressDbConfigured()) {
    try {
      const saved = await sbUpsertLabProgress(row);
      const local = loadLocal().filter((r) => r.id !== saved.id && r.labName !== saved.labName);
      local.push(saved);
      saveLocal(local);
      return saved;
    } catch (err) {
      console.warn("[lab-progress] supabase upsert failed, local only:", err);
    }
  }
  const local = loadLocal().filter((r) => r.id !== row.id && r.labName !== row.labName);
  local.push(row);
  saveLocal(local);
  return row;
}

export async function listLabProgress(): Promise<LabProgressRow[]> {
  if (isLabProgressDbConfigured()) {
    try {
      const rows = await sbListLabProgress();
      saveLocal(rows);
      return rows;
    } catch (err) {
      console.warn("[lab-progress] supabase list failed, local fallback:", err);
    }
  }
  return [...loadLocal()].sort((a, b) =>
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
  const existing = await getExistingByLabName(row.labName);
  const force = options?.force === true;

  let toSave = row;

  // 필증만 올린 경우: 기존 공정율은 유지하고 특이사항·확인일만 병합
  if (existing && isPermitOnlyRow(row)) {
    toSave = {
      ...existing,
      specialNotes: mergeSpecialNotes(existing.specialNotes, row.specialNotes),
      confirmedDate: row.confirmedDate ?? existing.confirmedDate,
      sourceFileName: row.sourceFileName ?? existing.sourceFileName,
      documentId: row.documentId ?? existing.documentId,
      updatedAt: new Date().toISOString(),
    };
  } else if (existing && !force) {
    const cmp = compareDate(row.confirmedDate, existing.confirmedDate);
    if (cmp < 0) {
      return {
        action: "stale",
        message: `현재자료가 더 최신자료입니다. (보관 ${existing.confirmedDate ?? "—"} / 업로드 ${row.confirmedDate ?? "—"}) 업데이트 할까요?`,
        row,
        existing,
      };
    }
    // 기성 업로드 시 기존 필증 특이사항 유지
    if (existing.specialNotes && /필증/.test(existing.specialNotes)) {
      toSave = {
        ...row,
        specialNotes: mergeSpecialNotes(row.specialNotes, existing.specialNotes),
      };
    }
  }

  const saved = await persistRow(toSave);
  return {
    action: existing ? "updated" : "created",
    message: existing
      ? isPermitOnlyRow(row)
        ? `${saved.labName} 특이사항에 필증 정보를 반영했습니다.`
        : `${saved.labName} 공정율을 갱신했습니다.`
      : isPermitOnlyRow(row)
        ? `${saved.labName} 필증 정보를 등록했습니다.`
        : `${saved.labName} 공정율을 등록했습니다.`,
    row: saved,
    existing,
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
    id: fund.id,
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
