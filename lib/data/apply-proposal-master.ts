import { extractLabNumber, compactSiteAddress, type ParsedProposal } from "@/lib/analyzers/proposal";
import { masterAddressIsTrustworthy } from "@/lib/analyzers/proposal-sanitize";
import { ensureSiteForProduct } from "@/lib/data/create-site";
import {
  getLabPortfolio,
  upsertLabFundFromProposal,
} from "@/lib/data/lab-portfolio";
import { matchProduct, upsertProduct } from "@/lib/data/product-registry";
import type { ProductMaster } from "@/lib/types";

function addressLooksLikeOtherLab(
  location: string | null | undefined,
  labName: string
): boolean {
  const loc = (location ?? "").replace(/\s+/g, "");
  const labNum = extractLabNumber(labName);
  if (!loc || loc.length < 8 || !labNum) return false;
  const portfolio = getLabPortfolio();
  if (!portfolio) return false;
  for (const f of portfolio.funds) {
    const otherNum = extractLabNumber(f.name);
    if (!otherNum || otherNum === labNum || !f.siteAddress) continue;
    const addr = f.siteAddress.replace(/\s+/g, "");
    if (addr.length < 8) continue;
    if (loc.includes(addr.slice(0, 10)) || addr.includes(loc.slice(0, 10))) {
      return true;
    }
  }
  return false;
}

/** 제안서 파싱 결과로 상품 마스터·랩 현황(마스터) 자동 반영 */
export function applyProposalMasterData(
  parsed: ParsedProposal,
  existing: ProductMaster | null,
  fileName: string,
  options?: { preserveIdentity?: boolean }
): { product: ProductMaster; siteId: string; applied: string[] } {
  const applied: string[] = [];
  const preserveIdentity = options?.preserveIdentity ?? false;
  const labName = parsed.labName?.trim() || existing?.labName || "";

  const portfolioFund = getLabPortfolio()?.funds.find(
    (f) => f.name.replace(/\s+/g, "") === labName.replace(/\s+/g, "")
  );

  const rawLocation = compactSiteAddress(parsed.location?.trim() || null);
  const locationIsOtherLab = addressLooksLikeOtherLab(rawLocation, labName);

  const existingAddress =
    portfolioFund?.siteAddress?.trim() || existing?.siteAddress?.trim() || "";
  const proposalAddress =
    rawLocation && !locationIsOtherLab ? rawLocation : null;

  // 기존 랩 선택 시: 펀드명은 마스터 유지, 주소는 신뢰 가능할 때만 유지
  let siteAddress: string;
  let fundName: string | null;
  if (preserveIdentity) {
    const keepMasterAddress = masterAddressIsTrustworthy(existingAddress);
    siteAddress = keepMasterAddress
      ? existingAddress
      : proposalAddress || existingAddress || "";
    fundName = portfolioFund?.fundName?.trim() || existing?.fundName?.trim() || null;
    if (keepMasterAddress) {
      applied.push("펀드명·주소: 기존 마스터 유지 (제안서 조건만 반영)");
    } else if (proposalAddress) {
      applied.push("펀드명: 기존 마스터 유지 · 주소: 제안서에서 반영");
    } else {
      applied.push("펀드명·주소: 기존 마스터 유지 (제안서 조건만 반영)");
    }
  } else {
    siteAddress = proposalAddress || existingAddress || "";
    fundName = locationIsOtherLab
      ? existing?.fundName || parsed.fundName?.trim() || null
      : parsed.fundName?.trim() || existing?.fundName || null;
    if (locationIsOtherLab) {
      applied.push("주소·펀드: 다른 랩 사업장과 동일해 기존값 유지");
    }
  }
  const siteName = parsed.siteName?.trim() || existing?.siteName || labName || "신규 사업장";
  const businessDesc = parsed.businessDesc?.trim() || siteName;

  const matched =
    existing ??
    matchProduct({
      siteName: parsed.siteName,
      fundName: parsed.fundName,
      location: parsed.location,
      fileName,
      labName: parsed.labName,
    });

  let product = upsertProduct({
    id: matched?.id,
    labName,
    fundName,
    siteAddress,
    siteName,
    aliases: [
      labName,
      fundName,
      siteAddress,
      siteName,
      ...(matched?.aliases ?? []),
      "길동",
      "IM_SH",
    ].filter(Boolean) as string[],
    siteId: matched?.siteId ?? null,
    contractAmount: parsed.totalBudget ?? matched?.contractAmount ?? null,
    notes: [
      parsed.constructionPeriod ? `공사기간 ${parsed.constructionPeriod}` : null,
      ...parsed.highlights,
    ]
      .filter(Boolean)
      .join(" · ") || null,
    hasProposal: true,
  });

  const siteId = ensureSiteForProduct(product);
  if (product.siteId !== siteId) {
    product = upsertProduct({ ...product, siteId });
  }

  const fund = upsertLabFundFromProposal({
    labName: product.labName || siteName,
    fundName: preserveIdentity ? undefined : product.fundName,
    siteAddress: siteAddress || undefined,
    businessDesc: parsed.businessDesc?.trim() || businessDesc,
    setupAmount: parsed.totalBudget ?? product.contractAmount,
    notes: product.notes,
    setupDate: parsed.setupDate,
    maturityDate: parsed.maturityDate,
    loanMaturityDate: parsed.loanMaturityDate,
    interestRate: parsed.interestRate,
    feeRate: parsed.feeRate,
    purchaseAgency: parsed.purchaseAgency,
    developer: parsed.developer,
    contractor: parsed.contractor,
    trustCompany: parsed.trustCompany,
    trustType: parsed.trustType,
    landArea: parsed.landArea,
    buildingArea: parsed.buildingArea,
    totalFloorArea: parsed.totalFloorArea,
    buildingScale: parsed.buildingScale,
    householdCount: parsed.householdCount,
  });

  if (labName) applied.push(`랩명 ${labName}`);
  if (fundName) applied.push(`펀드명 반영`);
  if (siteAddress) applied.push(`주소 반영`);
  if (parsed.totalBudget) applied.push(`설정/사업비 규모 반영`);
  if (parsed.setupDate) applied.push(`설정일 ${parsed.setupDate}`);
  if (parsed.maturityDate) applied.push(`펀드만기일 ${parsed.maturityDate}`);
  if (parsed.loanMaturityDate) applied.push(`대출만기일 ${parsed.loanMaturityDate}`);
  if (parsed.interestRate != null) applied.push(`금리 ${parsed.interestRate}%`);
  if (parsed.feeRate != null) applied.push(`수수료율 ${parsed.feeRate}%`);
  if (parsed.purchaseAgency) applied.push(`매입기관 ${parsed.purchaseAgency}`);
  if (parsed.landArea || parsed.buildingScale) applied.push(`건축개요 반영`);
  applied.push(`전체현황 마스터 반영: ${fund.name}`);
  applied.push("제안서 여부: 있음");

  return { product, siteId, applied };
}
