import { normalizePdfText } from "@/lib/analyzers/pdf-extract";

export interface ParsedProposal {
  siteName: string | null;
  fundName: string | null;
  totalBudget: number | null;
  constructionPeriod: string | null;
  location: string | null;
  highlights: string[];
}

export function parseProposalText(rawText: string, fileName: string): ParsedProposal {
  const text = normalizePdfText(rawText);

  const result: ParsedProposal = {
    siteName: null,
    fundName: null,
    totalBudget: null,
    constructionPeriod: null,
    location: null,
    highlights: [],
  };

  const fundMatch = text.match(/(엘엔에스[^\n]{0,60}제\d+호)/);
  if (fundMatch) result.fundName = fundMatch[1].trim();

  if (fileName.includes("길동") || text.includes("길동")) {
    result.siteName = "길동 IM_SH";
    result.location = "서울 강동구 길동";
  }

  const budgetMatch =
    text.match(/(?:총\s*사업비|공사비|투자금액)[:\s]*([\d,]+)\s*(?:억|원)?/i) ??
    text.match(/([\d,]+)\s*억\s*원/);
  if (budgetMatch) {
    const num = parseInt(budgetMatch[1].replace(/,/g, ""), 10);
    result.totalBudget = budgetMatch[0].includes("억") ? num * 100_000_000 : num;
  }

  const periodMatch = text.match(/(\d{4})\.\s*(\d{1,2})\.\s*[^~]*~\s*(\d{4})\.\s*(\d{1,2})/);
  if (periodMatch) {
    result.constructionPeriod = `${periodMatch[1]}.${periodMatch[2]} ~ ${periodMatch[3]}.${periodMatch[4]}`;
  }

  if (text.includes("매입이행약정")) result.highlights.push("매입이행약정 체결");
  if (text.includes("CM을 통해")) result.highlights.push("CM 월별 공성/공정실사 관리");
  if (text.includes("ESG")) result.highlights.push("ESG 일반사모투자신탁");

  return result;
}
