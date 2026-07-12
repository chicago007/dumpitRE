import { normalizePdfText } from "@/lib/analyzers/pdf-extract";
import type { DocumentType } from "@/lib/types";

export interface TradeProgress {
  trade: string;
  actual: number;
  planned: number;
}

export interface ParsedCostCmReport {
  siteName: string | null;
  reportRound: number | null;
  reportDate: string | null;
  reportMonth: string | null;
  contractor: string | null;
  cmCompany: string | null;
  contractAmount: number | null;
  overallProgressPct: number | null;
  plannedProgressPct: number | null;
  achievementPct: number | null;
  cumulativeFundPct: number | null;
  monthlyFundAmount: number | null;
  cumulativeFundAmount: number | null;
  delayMonths: number | null;
  trades: TradeProgress[];
  rawNotes: string[];
}

function parseAmount(str: string): number {
  return parseInt(str.replace(/,/g, ""), 10);
}

function parsePct(str: string): number {
  return parseFloat(str.replace(/%/g, ""));
}

/** COST CM 기성실사보고서 PDF 텍스트 파싱 */
export function parseCostCmReport(rawText: string, fileName: string): ParsedCostCmReport {
  const text = normalizePdfText(rawText);
  const notes: string[] = [];

  const result: ParsedCostCmReport = {
    siteName: null,
    reportRound: null,
    reportDate: null,
    reportMonth: null,
    contractor: null,
    cmCompany: "코스트CM",
    contractAmount: null,
    overallProgressPct: null,
    plannedProgressPct: null,
    achievementPct: null,
    cumulativeFundPct: null,
    monthlyFundAmount: null,
    cumulativeFundAmount: null,
    delayMonths: null,
    trades: [],
    rawNotes: notes,
  };

  const roundMatch =
    text.match(/제\s*(\d+)\s*회\s*CM\s*기성실사/i) ??
    text.match(/제\s*(\d+)\s*회\s*기성실사/i);
  if (roundMatch) {
    result.reportRound = parseInt(roundMatch[1], 10);
    notes.push(`제${roundMatch[1]}회 기성실사`);
  }

  const titleMatch = text.match(/『([^』]+)』/);
  if (titleMatch) {
    result.siteName = titleMatch[1].replace(/\s+/g, " ").trim();
  }

  if (!result.siteName) {
    const projectMatch = text.match(
      /((?:의정부|광진|도봉|서울|경기)[^\n]{0,80}(?:신축공사|주택|오피스텔)[^\n]{0,40})/i
    );
    if (projectMatch) result.siteName = projectMatch[1].replace(/\s+/g, " ").trim();
  }

  const dateMatches = [...text.matchAll(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)];
  if (dateMatches.length > 0) {
    const d = dateMatches[dateMatches.length - 1];
    result.reportDate = `${d[1]}-${d[2].padStart(2, "0")}-${d[3].padStart(2, "0")}`;
    result.reportMonth = `${d[1]}-${d[2].padStart(2, "0")}-01`;
  }

  const contractorPatterns = [
    /시공사\s+([^(■\n]{2,40}?)(?:\s+\d{4}|\s+■|$)/,
    /시공사\s+(.{2,30?(?:건설|월드|토피아|하임)[^\s]{0,20})/,
  ];
  for (const pat of contractorPatterns) {
    const m = text.match(pat);
    if (m) {
      result.contractor = m[1].replace(/\s+/g, " ").trim();
      break;
    }
  }

  const summaryRow = text.match(
    /합\s*계\s+100(?:\.00)?%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)(?:%\s+([\d.]+)%)?/
  );
  if (summaryRow) {
    result.plannedProgressPct = parsePct(summaryRow[5]);
    result.overallProgressPct = parsePct(summaryRow[6]);
    if (summaryRow[7]) result.achievementPct = parsePct(summaryRow[7]);
    notes.push(`공정 누계: 계획 ${result.plannedProgressPct}%, 실적 ${result.overallProgressPct}%`);
  }

  if (result.overallProgressPct == null) {
    const mgmt = text.match(/실시\s*\(B\)\s+([\d.]+)%/);
    const plan = text.match(/계획\(.*?차\)\s*\(A\)\s+([\d.]+)%/);
    if (mgmt) result.overallProgressPct = parsePct(mgmt[1]);
    if (plan) result.plannedProgressPct = parsePct(plan[1]);
  }

  const tradePatterns = [
    /(토목(?:공사)?)\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%/g,
    /(건축(?:공사)?)\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%/g,
    /(기계(?:설비)?(?:공사)?)\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%/g,
    /(전기(?:공사)?)\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%/g,
    /(통신(?:공사)?)\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%/g,
    /(소방(?:공사)?)\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%/g,
    /(간접비)\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%/g,
  ];

  const seenTrades = new Set<string>();
  for (const pat of tradePatterns) {
    for (const m of text.matchAll(pat)) {
      const trade = m[1].replace(/공사$/, "").trim();
      if (seenTrades.has(trade)) continue;
      seenTrades.add(trade);
      result.trades.push({
        trade,
        planned: parsePct(m[7]),
        actual: parsePct(m[8]),
      });
    }
  }

  const contractMatch =
    text.match(/공사도급계약금액\s*:\s*[^₩(]*[₩(]\s*([\d,]+)/) ??
    text.match(/총\s*계\s+([\d,]+)\s+[\d,]+\s+[\d,]+\s+[\d,]+\s+([\d.]+)%/);
  if (contractMatch) {
    result.contractAmount = parseAmount(contractMatch[1]);
  }

  const fundRateMatch = text.match(/누계기성\s+([\d.]+)%/);
  if (fundRateMatch) {
    result.cumulativeFundPct = parsePct(fundRateMatch[1]);
    notes.push(`누계 기성률 ${result.cumulativeFundPct}%`);
  }

  const totalFundMatch = text.match(
    /([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d.]+)%\s*$/m
  );
  const amountLine = text.match(
    /20[\d,]+\s+[\d,]+\s+[\d,]+\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d.]+)%/
  );
  if (amountLine) {
    result.cumulativeFundAmount = parseAmount(amountLine[3]);
    result.monthlyFundAmount = parseAmount(amountLine[2]);
  }

  const delayMatch = text.match(/지연개월\s+([\d.]+)/);
  if (delayMatch) result.delayMonths = parseFloat(delayMatch[1]);

  if (!result.siteName) {
    result.siteName = inferSiteNameFromFileName(fileName);
  }

  return result;
}

export function inferDocumentType(fileName: string): DocumentType {
  const lower = fileName.toLowerCase();
  if (lower.includes("기성") || lower.includes("공정")) return "progress_report";
  if (lower.includes("제안") || lower.includes("proposal") || lower.includes("im_sh")) return "proposal";
  if (lower.includes("자금") || lower.includes("집행")) return "fund_schedule";
  return "other";
}

export function inferSiteNameFromFileName(fileName: string): string | null {
  if (fileName.includes("호원동")) return "의정부시 호원동 57-3외 LH매입 공동주택 및 오피스텔 신축공사";
  if (fileName.includes("자양동")) return "광진구 자양동 491-5 도시형생활주택 신축공사";
  if (fileName.includes("창동")) return "도봉구 창동 609-44 오피스텔, 단지형 다세대 주택 신축공사";
  if (fileName.includes("길동")) return "길동 IM_SH 투자제안";
  return null;
}

export function resolveSiteId(siteName: string | null, fileName: string): string | null {
  const hay = `${siteName ?? ""} ${fileName}`;
  if (/호원|의정부/.test(hay)) return "site-hwawon";
  if (/자양|광진/.test(hay)) return "site-jayang";
  if (/창동|도봉|609/.test(hay)) return "site-changdong";
  if (/길동|im_sh/i.test(hay)) return "site-gildong";
  return null;
}

// backward compat
export const parseProgressReportText = parseCostCmReport;
