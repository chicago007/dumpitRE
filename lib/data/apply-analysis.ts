import type { ParsedCostCmReport } from "@/lib/analyzers/progress-report";
import type { ParsedProposal } from "@/lib/analyzers/proposal";
import type { DocumentRecord, FundSchedule, ProgressReport, Site } from "@/lib/types";

export interface AnalysisApplyResult {
  siteId: string | null;
  siteName: string | null;
  applied: string[];
  warnings: string[];
}

export function applyCostCmReport(
  sites: Site[],
  progressReports: ProgressReport[],
  fundSchedules: FundSchedule[],
  siteId: string | null,
  parsed: ParsedCostCmReport,
  documentId: string
): AnalysisApplyResult {
  const applied: string[] = [];
  const warnings: string[] = [];

  if (!siteId) {
    warnings.push("사업장 자동 매칭 실패 — 수동 검수 필요");
    return { siteId: null, siteName: parsed.siteName, applied, warnings };
  }

  const siteIdx = sites.findIndex((s) => s.id === siteId);
  if (siteIdx === -1) {
    warnings.push("알 수 없는 siteId");
    return { siteId, siteName: parsed.siteName, applied, warnings };
  }

  const site = sites[siteIdx];

  if (parsed.overallProgressPct != null && parsed.reportMonth) {
    const pr: ProgressReport = {
      id: `pr-${documentId.slice(0, 8)}`,
      siteId,
      reportMonth: parsed.reportMonth,
      overallProgressPct: parsed.overallProgressPct,
      plannedProgressPct: parsed.plannedProgressPct ?? parsed.overallProgressPct,
      details: parsed.trades.map((t) => ({
        trade: t.trade,
        actual: t.actual,
        planned: t.planned,
      })),
      notes: parsed.reportRound ? `제${parsed.reportRound}회 CM기성실사` : null,
    };

    const existingIdx = progressReports.findIndex(
      (p) => p.siteId === siteId && p.reportMonth === parsed.reportMonth
    );
    if (existingIdx >= 0) progressReports[existingIdx] = pr;
    else progressReports.unshift(pr);

    sites[siteIdx] = {
      ...site,
      latestProgressPct: parsed.overallProgressPct,
      plannedProgressPct: parsed.plannedProgressPct,
      latestReportMonth: parsed.reportMonth,
      contractor: parsed.contractor ?? site.contractor,
      contractAmount: parsed.contractAmount ?? site.contractAmount,
      status: site.status === "planned" ? "in_progress" : site.status,
    };
    applied.push(`공정율 ${parsed.overallProgressPct}% (계획 ${parsed.plannedProgressPct}%)`);
  }

  if (parsed.cumulativeFundPct != null && parsed.reportMonth) {
    const planned = parsed.monthlyFundAmount ?? 0;
    const actual = parsed.monthlyFundAmount ?? null;
    const fs: FundSchedule = {
      id: `fs-${documentId.slice(0, 8)}`,
      siteId,
      scheduleMonth: parsed.reportMonth,
      plannedAmount: planned,
      actualAmount: actual,
    };

    const fsIdx = fundSchedules.findIndex(
      (f) => f.siteId === siteId && f.scheduleMonth === parsed.reportMonth
    );
    if (fsIdx >= 0) fundSchedules[fsIdx] = fs;
    else fundSchedules.unshift(fs);

    sites[siteIdx] = {
      ...sites[siteIdx],
      latestFundPct: parsed.cumulativeFundPct,
    };
    applied.push(`누계 기성률 ${parsed.cumulativeFundPct}%`);
  }

  if (parsed.delayMonths != null && parsed.delayMonths > 0) {
    warnings.push(`공기 지연 ${parsed.delayMonths}개월`);
  }

  return {
    siteId,
    siteName: sites[siteIdx].name,
    applied,
    warnings,
  };
}

export function applyProposal(
  sites: Site[],
  siteId: string | null,
  parsed: ParsedProposal
): AnalysisApplyResult {
  const applied: string[] = [];
  const warnings: string[] = [];

  if (!siteId) {
    warnings.push("제안서 사업장 매칭 실패");
    return { siteId: null, siteName: parsed.siteName, applied, warnings };
  }

  const siteIdx = sites.findIndex((s) => s.id === siteId);
  if (siteIdx === -1) return { siteId, siteName: parsed.siteName, applied, warnings };

  sites[siteIdx] = {
    ...sites[siteIdx],
    name: parsed.siteName ?? sites[siteIdx].name,
    contractAmount: parsed.totalBudget ?? sites[siteIdx].contractAmount,
    address: parsed.location ?? sites[siteIdx].address,
    status: "planned",
  };

  if (parsed.fundName) applied.push(`펀드: ${parsed.fundName}`);
  if (parsed.totalBudget) applied.push(`대출/사업비 규모 반영`);
  if (parsed.highlights.length) applied.push(...parsed.highlights.slice(0, 2));

  return { siteId, siteName: sites[siteIdx].name, applied, warnings };
}
