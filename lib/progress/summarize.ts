import type {
  GisungExtracted,
  PortfolioMatchCandidate,
  ProgressSummaryReport,
} from "@/lib/progress/types";
import {
  decideAutoMatch,
  matchPortfolio,
  type PortfolioFundRow,
} from "@/lib/progress/match-portfolio";

function confidence(
  top: PortfolioMatchCandidate | undefined,
  needsConfirmation: boolean
): ProgressSummaryReport["matchConfidence"] {
  if (needsConfirmation || !top) return needsConfirmation ? "low" : "none";
  if (top.score >= 70) return "high";
  if (top.score >= 45) return "medium";
  return "low";
}

/** 추출 + 포트폴리오 → 최종 요약 */
export function buildProgressSummary(
  extracted: GisungExtracted,
  funds: PortfolioFundRow[]
): ProgressSummaryReport {
  const candidates = matchPortfolio(extracted, funds);
  const decision = decideAutoMatch(candidates, funds, {
    extractedAddress: extracted.siteAddress,
    multiFundHints: extracted.fundRoundHints,
    fundNameHint: extracted.fundNameHint,
    operatorHints: extracted.operatorHints,
  });
  const display =
    decision.sharedSiteGroup.length > 0
      ? decision.sharedSiteGroup
      : candidates.slice(0, 5);
  const ordered = decision.suggested
    ? [
        decision.suggested,
        ...display.filter((c) => c.labName !== decision.suggested!.labName),
      ]
    : display;
  const top = decision.match ?? decision.suggested ?? ordered[0];

  return {
    labName: decision.match?.labName ?? null,
    fundName: decision.match?.fundName ?? null,
    siteAddress: decision.match?.siteAddress ?? extracted.siteAddress,
    confirmedDate: extracted.reportDate,
    plannedProgressPct: extracted.plannedProgressPct,
    actualProgressPct: extracted.actualProgressPct,
    achievementPct: extracted.achievementPct,
    delayDays: extracted.delayDays,
    specialNotes: extracted.specialNotesSummary,
    matchConfidence: confidence(top, decision.needsConfirmation),
    matchCandidates: ordered.slice(0, 5),
    source: extracted,
  };
}

export function formatSummaryKo(report: ProgressSummaryReport): string {
  const lines = [
    "=== 기성보고서 공정율 요약 ===",
    `부동산랩: ${report.labName ?? "(미매칭)"}`,
    `펀드: ${report.fundName ?? "(미매칭)"}`,
    `사업장 주소: ${report.siteAddress ?? "(없음)"}`,
    `확인날짜: ${report.confirmedDate ?? "—"}`,
    `계획: ${report.plannedProgressPct != null ? `${report.plannedProgressPct}%` : "—"}`,
    `실적: ${report.actualProgressPct != null ? `${report.actualProgressPct}%` : "—"}`,
    `달성률: ${report.achievementPct != null ? `${report.achievementPct}%` : "—"}`,
    `지연일수: ${report.delayDays != null ? `${report.delayDays}일` : "—"}`,
    `특이사항: ${report.specialNotes ?? "—"}`,
    `매칭신뢰도: ${report.matchConfidence}` +
      (report.matchCandidates[0]
        ? ` (score ${report.matchCandidates[0].score})`
        : ""),
  ];
  return lines.join("\n");
}
