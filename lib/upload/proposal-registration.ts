import { extractLabNumber } from "@/lib/analyzers/proposal";
import type { ParsedProposal } from "@/lib/analyzers/proposal";
import { getLabPortfolio } from "@/lib/data/lab-portfolio";
import { matchProduct } from "@/lib/data/product-registry";
import type { ProposalRegistrationPrompt } from "@/lib/types";

/** PDF 제안서로 처리할지 (유형 선택·파일명 모두 고려) */
export function shouldTreatAsProposal(
  fileName: string,
  typeParam: string,
  isPdf: boolean
): boolean {
  if (!isPdf) return false;
  if (typeParam === "progress_report") return false;
  if (typeParam === "proposal") return true;

  const lower = fileName.toLowerCase();
  if (lower.includes("제안") || lower.includes("proposal") || lower.includes("im")) {
    return true;
  }
  if (/부동산\s*랩/.test(fileName) || /랩\s*제?\s*\d{1,3}\s*호/.test(fileName)) {
    return true;
  }
  // iM 랩 XX호 제안서 등 — 숫자+호만 있어도 제안서로 간주
  if (/\d{1,3}\s*호/.test(fileName) && lower.endsWith(".pdf")) {
    return true;
  }
  return false;
}

export function buildProposalRegistrationPrompt(input: {
  documentId: string;
  fileName: string;
  parsed: ParsedProposal;
}): ProposalRegistrationPrompt {
  const { documentId, fileName, parsed } = input;
  const product = matchProduct({
    siteName: parsed.siteName,
    fundName: parsed.fundName,
    location: parsed.location,
    fileName,
    labName: parsed.labName,
  });

  const portfolio = getLabPortfolio();
  const labOptions = (portfolio?.funds ?? [])
    .filter((f) => f.name?.trim())
    .map((f) => ({
      id: f.id,
      name: f.name,
      fundName: f.fundName,
      siteAddress: f.siteAddress,
    }))
    .sort((a, b) => {
      const na = Number(extractLabNumber(a.name) ?? 0);
      const nb = Number(extractLabNumber(b.name) ?? 0);
      return nb - na;
    });

  const suggestedLabNum = extractLabNumber(parsed.labName, fileName);
  const matchedLab =
    labOptions.find(
      (o) => suggestedLabNum && extractLabNumber(o.name) === suggestedLabNum
    ) ??
    labOptions.find((o) => o.name === product?.labName) ??
    null;

  return {
    documentId,
    fileName,
    suggestedSiteName: parsed.siteName,
    suggestedFundName: parsed.fundName,
    suggestedLabName: parsed.labName,
    suggestedLocation: parsed.location ?? product?.siteAddress ?? null,
    suggestedBudget: parsed.totalBudget,
    matchedProductId: product?.id ?? null,
    matchedLabFundId: matchedLab?.id ?? null,
    matchedLabel: matchedLab
      ? [matchedLab.name, matchedLab.fundName, matchedLab.siteAddress]
          .filter(Boolean)
          .join(" · ")
      : product
        ? [product.labName, product.fundName, product.siteAddress]
            .filter(Boolean)
            .join(" · ")
        : null,
    labOptions,
    question:
      "이 제안서를 신규 부동산랩으로 등록할까요, 아니면 기존 목록에 반영할까요?",
  };
}
