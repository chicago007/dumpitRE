import type { ParsedProposal } from "@/lib/analyzers/proposal";
import { extractLabNumber } from "@/lib/analyzers/proposal";

const JUNK =
  /of\s*\d+|appendix|본\s*자료|시장\s*예측|투자리스크|우발채무|사업계획\s*승인|--\s*\d|\d\s*of\s*\d|집합투자업자|리스크\s*최소화/i;

function unavailable(v: string | null | undefined): boolean {
  if (!v) return true;
  const s = v.replace(/\s+/g, "").toLowerCase();
  return !s || s === "확인불가" || s === "n/a" || s === "-" || s === "—";
}

function cleanShort(value: string | null | undefined, maxLen: number): string | null {
  if (unavailable(value)) return null;
  let s = String(value).replace(/\s+/g, " ").trim();
  s = s.replace(/^[:：\-–—|·]+\s*/, "").replace(/\s*[:：\-–—|·]+$/, "");
  if (!s || s.length < 2) return null;
  // 명백한 슬라이드 잡음만 제거 (길이 제한은 느슨하게 — LLM 값을 과도하게 버리지 않음)
  if (JUNK.test(s) && /of\s*\d+|appendix/i.test(s)) return null;
  if (JUNK.test(s) && s.length > 80) return null;
  if (s.length > maxLen) s = s.slice(0, maxLen).trim();
  if ((s.match(/[가-힣A-Za-z0-9]/g) ?? []).length < 2) return null;
  return s;
}

function cleanDate(value: string | null | undefined): string | null {
  if (unavailable(value)) return null;
  const m = String(value).match(/(\d{4})[-./년]\s*(\d{1,2})[-./월]?\s*(\d{1,2})?/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${(m[3] ?? "01").padStart(2, "0")}`;
}

function cleanRate(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0 || value >= 40) return null;
  return value;
}

/** iM 제안서 뒤쪽 포트폴리오 슬라이드에 반복되는 36호/제72호/인계동 예시 문구 */
const PORTFOLIO_TEMPLATE_FUND =
  /엘엔에스\s*ESG\s*일반사모투자신탁\s*제\s*72\s*호/i;
const PORTFOLIO_TEMPLATE_ADDR =
  /수원시\s*팔달구\s*인계동\s*1123[\-\s]*19/i;

const WEAK_MASTER_ADDRESS =
  /^(테스트|test|미기재|없음|확인\s*중|tbd|n\/a|임시|-+|\.+)$/i;

/** iM 포트폴리오 슬라이드에 반복되는 타 랩 예시 주소 */
export function isTemplatePollutedAddress(
  address: string | null | undefined
): boolean {
  if (!address?.trim()) return false;
  return PORTFOLIO_TEMPLATE_ADDR.test(address.replace(/\s+/g, ""));
}

/** 마스터에 저장된 주소가 실제 사업장으로 쓸 수 없는 경우 */
export function isWeakMasterAddress(
  address: string | null | undefined
): boolean {
  const s = (address ?? "").trim();
  if (!s) return true;
  const compact = s.replace(/\s+/g, "");
  if (compact.length < 6) return true;
  if (WEAK_MASTER_ADDRESS.test(compact)) return true;
  if (isTemplatePollutedAddress(s)) return true;
  const hasRegion =
    /(서울|경기|인천|부산|대구|대전|광주|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)/.test(
      s
    );
  if (!hasRegion && compact.length < 12) return true;
  return false;
}

export function masterAddressIsTrustworthy(
  address: string | null | undefined
): boolean {
  return !isWeakMasterAddress(address);
}

/**
 * 다른 랩 포트폴리오 예시가 본문에서 잘못 추출된 경우 제거.
 * (51·52·53호 제안서에 36호 사업장 주소/펀드가 공통으로 박히는 현상)
 */
export function stripTemplatePollution(
  parsed: ParsedProposal,
  labName: string | null | undefined
): ParsedProposal {
  const labNum = extractLabNumber(labName);
  if (!labNum || labNum === "36") return parsed;

  let fundName = parsed.fundName;
  let location = parsed.location;

  if (fundName && PORTFOLIO_TEMPLATE_FUND.test(fundName.replace(/\s+/g, " "))) {
    fundName = null;
  }
  if (location && PORTFOLIO_TEMPLATE_ADDR.test(location.replace(/\s+/g, ""))) {
    location = null;
  }

  return { ...parsed, fundName, location };
}

/** 제안서 자동추출 중 슬라이드 문구·페이지번호 등 잡음을 제거 */
export function sanitizeParsedProposal(parsed: ParsedProposal): ParsedProposal {
  const cleaned = {
    ...parsed,
    siteName: cleanShort(parsed.siteName, 40),
    fundName: cleanShort(parsed.fundName, 80),
    labName: cleanShort(parsed.labName, 40),
    location: cleanShort(parsed.location, 120),
    constructionPeriod: cleanShort(parsed.constructionPeriod, 40),
    purchaseAgency: cleanShort(parsed.purchaseAgency, 40),
    developer: cleanShort(parsed.developer, 80),
    contractor: cleanShort(parsed.contractor, 80),
    trustCompany: cleanShort(parsed.trustCompany, 80),
    trustType: cleanShort(parsed.trustType, 60),
    businessDesc: cleanShort(parsed.businessDesc, 200),
    landArea: cleanShort(parsed.landArea, 120),
    buildingArea: cleanShort(parsed.buildingArea, 120),
    totalFloorArea: cleanShort(parsed.totalFloorArea, 120),
    buildingScale: cleanShort(parsed.buildingScale, 120),
    householdCount: cleanShort(parsed.householdCount, 60),
    setupDate: cleanDate(parsed.setupDate),
    maturityDate: cleanDate(parsed.maturityDate),
    loanMaturityDate: cleanDate(parsed.loanMaturityDate),
    interestRate: cleanRate(parsed.interestRate),
    feeRate: cleanRate(parsed.feeRate),
    totalBudget:
      parsed.totalBudget != null && parsed.totalBudget > 0 ? parsed.totalBudget : null,
    highlights: parsed.highlights.filter((h) => h.length <= 60 && !JUNK.test(h)),
  };
  return stripTemplatePollution(cleaned, parsed.labName);
}
