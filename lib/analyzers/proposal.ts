import { normalizePdfText } from "@/lib/analyzers/pdf-extract";

export interface ParsedProposal {
  siteName: string | null;
  fundName: string | null;
  labName: string | null;
  totalBudget: number | null;
  constructionPeriod: string | null;
  location: string | null;
  setupDate: string | null;
  maturityDate: string | null;
  loanMaturityDate: string | null;
  interestRate: number | null;
  feeRate: number | null;
  purchaseAgency: string | null;
  developer: string | null;
  contractor: string | null;
  trustCompany: string | null;
  trustType: string | null;
  businessDesc: string | null;
  landArea: string | null;
  buildingArea: string | null;
  totalFloorArea: string | null;
  buildingScale: string | null;
  householdCount: string | null;
  highlights: string[];
}

function emptyProposal(): ParsedProposal {
  return {
    siteName: null,
    fundName: null,
    labName: null,
    totalBudget: null,
    constructionPeriod: null,
    location: null,
    setupDate: null,
    maturityDate: null,
    loanMaturityDate: null,
    interestRate: null,
    feeRate: null,
    purchaseAgency: null,
    developer: null,
    contractor: null,
    trustCompany: null,
    trustType: null,
    businessDesc: null,
    landArea: null,
    buildingArea: null,
    totalFloorArea: null,
    buildingScale: null,
    householdCount: null,
    highlights: [],
  };
}

function toIsoDate(y: string, m: string, d?: string): string {
  return `${y}-${m.padStart(2, "0")}-${(d ?? "01").padStart(2, "0")}`;
}

/** 펀드명(투자신탁 제N호·펀드N호)을 랩 번호로 오인하지 않기 위한 필터 */
function isFundNumberContext(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 24), index);
  return /투자신탁|펀드|사모\s*투자/i.test(before);
}

/** 텍스트/파일명에서 랩 번호 추출 (예: 51). 펀드 번호(제72호 등)는 제외 */
export function extractLabNumber(
  ...sources: Array<string | null | undefined>
): string | null {
  // 1) 명시적 "부동산랩/랩 N호"만 — 파일명 우선을 위해 sources 순서 존중
  for (const raw of sources) {
    if (!raw) continue;
    const text = String(raw).normalize("NFC");
    const labeled =
      text.match(/부동산\s*랩\s*제?\s*(\d{1,3})\s*호/) ??
      text.match(/제\s*(\d{1,3})\s*호\s*부동산\s*랩/) ??
      text.match(/(?:^|[^가-힣A-Za-z])랩\s*제?\s*(\d{1,3})\s*호/);
    if (labeled?.[1]) return labeled[1];
  }

  // 2) 일반 "N호" — 펀드 문맥 제외, 파일명처럼 짧은 문자열에서만
  for (const raw of sources) {
    if (!raw) continue;
    const text = String(raw).normalize("NFC");
    for (const m of text.matchAll(/(?:^|[^\d])(\d{1,3})\s*호(?:[^\d가-힣]|$)/g)) {
      const num = m[1];
      const idx = m.index ?? 0;
      // matchAll 에서 (?:^|[^\d]) 가 앞에 있으면 실제 숫자는 +1일 수 있음
      const numIdx = text.indexOf(num + "호", idx);
      if (numIdx >= 0 && isFundNumberContext(text, numIdx)) continue;
      if (/펀드\s*$/i.test(text.slice(Math.max(0, numIdx - 4), numIdx))) continue;
      const v = Number(num);
      if (v >= 1 && v <= 200) return num;
    }

    // 파일명: 앞 epoch 제거 후 …_51_….pdf
    if (text.length <= 180 || /\.(pdf|xlsx?)$/i.test(text)) {
      const base = text.replace(/^\d{10,}_/, "").replace(/\.[^.]+$/, "");
      const nums = [...base.matchAll(/(?:^|[_\-.\s])(\d{1,3})(?=[_\-.\s]|$)/g)].map(
        (m) => m[1]
      );
      const plausible = nums.filter((n) => {
        const v = Number(n);
        return v >= 1 && v <= 200;
      });
      if (plausible.length) return plausible[plausible.length - 1];
    }
  }
  return null;
}

export function formatLabName(num: string | number): string {
  return `부동산랩 ${num}호`;
}

/** PDF 추출 location → 사업장 주소 필드용 (용도·면적 잡음 제거) */
export function compactSiteAddress(
  location: string | null | undefined
): string | null {
  if (!location?.trim()) return null;
  let s = location.replace(/\s+/g, " ").trim();
  s = s.split(/\s+지\s*역|\s+대\s*지\s*면|\s+건\s*축\s*면|\s+전\s*체\s*연\s*면\s*적/)[0].trim();
  s = s.replace(/\s*[,，]\s*$/, "").trim();
  if (s.length > 100) s = s.slice(0, 100).trim();
  return s.length >= 6 ? s : null;
}

function parseDateNear(label: RegExp, text: string): string | null {
  const m =
    text.match(
      new RegExp(
        label.source +
          "[^\\d]{0,12}(\\d{4})[.\\-/년]\\s*(\\d{1,2})[.\\-/월]?\\s*(\\d{1,2})?",
        "i"
      )
    ) ??
    text.match(new RegExp(label.source + "[^\\d]{0,12}(\\d{4})\\.\\s*(\\d{1,2})", "i"));
  if (!m) return null;
  return toIsoDate(m[1], m[2], m[3]);
}

export function parseProposalText(rawText: string, fileName: string): ParsedProposal {
  const text = normalizePdfText(rawText);
  const result = emptyProposal();

  const fundMatch =
    text.match(/(엘엔에스[^\n]{0,60}제\s*\d+\s*호)/) ??
    text.match(/(엘앤에스[^\n]{0,60}제\s*\d+\s*호)/) ??
    text.match(/((?:일반)?사모투자신탁[^\n]{0,40}제\s*\d+\s*호)/);
  if (fundMatch) result.fundName = fundMatch[1].replace(/\s+/g, " ").trim();

  // 파일명의 랩 번호가 본문 펀드번호(제72호 등)보다 신뢰도 높음
  const labNum =
    extractLabNumber(fileName, text) ??
    fileName.match(/부동산\s*랩\s*제?\s*(\d+)\s*호/)?.[1] ??
    null;
  if (labNum) result.labName = formatLabName(labNum);

  if (fileName.includes("길동") || text.includes("길동")) {
    result.siteName = "길동 IM_SH";
    result.location =
      text.match(/서울[^\n]{0,20}강동구[^\n]{0,20}길동[^\n]{0,30}/)?.[0]?.replace(/\s+/g, " ").trim() ??
      "서울 강동구 길동";
  }

  const addrMatch =
    text.match(/(?:사업장\s*소재지|대지위치|소재지|사업지|위치|주소)[:\s]*([^\n]{6,100})/) ??
    text.match(/(서울[^\n]{0,40}(?:구|동)[^\n]{0,40})/) ??
    text.match(/(경기[^\n]{0,40}(?:시|구|동)[^\n]{0,40})/);
  if (addrMatch && !result.location) {
    result.location = addrMatch[1].replace(/\s+/g, " ").trim();
  }

  const budgetMatch =
    text.match(/(?:고객\s*납입\s*금액|납입금액|설정액|펀드\s*규모)[:\s]*([\d,]+)\s*억/i) ??
    text.match(/(?:총\s*사업비|공사비|투자금액)[:\s]*([\d,]+)\s*억/i) ??
    text.match(/([\d,]+)\s*억\s*원/);
  if (budgetMatch) {
    const num = parseInt(budgetMatch[1].replace(/,/g, ""), 10);
    result.totalBudget = num * 100_000_000;
  }

  const periodMatch = text.match(/(\d{4})\.\s*(\d{1,2})\.\s*[^~]*~\s*(\d{4})\.\s*(\d{1,2})/);
  if (periodMatch) {
    result.constructionPeriod = `${periodMatch[1]}.${periodMatch[2]} ~ ${periodMatch[3]}.${periodMatch[4]}`;
    if (!result.setupDate) result.setupDate = toIsoDate(periodMatch[1], periodMatch[2]);
    if (!result.maturityDate) result.maturityDate = toIsoDate(periodMatch[3], periodMatch[4]);
  }

  result.setupDate =
    result.setupDate ??
    parseDateNear(/(?:펀드\s*설정일|설정일|투자기간\s*개시|개시일)/, text);
  result.maturityDate =
    result.maturityDate ??
    parseDateNear(/(?:펀드\s*만기일|펀드\s*만기|만기일(?!\s*대출))/, text);
  result.loanMaturityDate = parseDateNear(/(?:대출\s*만기일|대출만기)/, text);

  const rateMatch =
    text.match(/(?:목표\s*수익률|목표수익률)[:\s]*([\d.]+)\s*%/) ??
    text.match(/(?:금리|이자율|수익률)[:\s]*([\d.]+)\s*%/) ??
    text.match(/연\s*([\d.]+)\s*%/);
  if (rateMatch) {
    const n = Number(rateMatch[1]);
    if (Number.isFinite(n)) result.interestRate = n > 1 ? n : n * 100;
  }

  const feeMatch = text.match(/(?:운용사\s*특별\s*용역\s*보수|특별용역보수)[^\d%]{0,20}([\d.]+)\s*%/);
  if (feeMatch) {
    const n = Number(feeMatch[1]);
    if (Number.isFinite(n)) result.feeRate = n > 1 ? n : n * 100;
  }

  const shMatch = text.match(/\b(SH|GH|LH)\b/);
  if (shMatch) result.purchaseAgency = shMatch[1];
  else {
    const agencyMatch = text.match(/(?:매입(?:이행)?약정(?:기관)?|매입약정|매입기관)[:\s]*([^\n]{2,40})/);
    if (agencyMatch) result.purchaseAgency = agencyMatch[1].replace(/\s+/g, " ").trim();
  }

  const developerMatch = text.match(/(?:시행사)[:\s]*([^\n]{2,40})/);
  if (developerMatch) result.developer = developerMatch[1].replace(/\s+/g, " ").trim();

  const contractorMatch = text.match(/(?:시공사)[:\s]*([^\n]{2,40})/);
  if (contractorMatch) result.contractor = contractorMatch[1].replace(/\s+/g, " ").trim();

  const trustCoMatch = text.match(/(?:신탁사|수탁사)[:\s]*([^\n]{2,40})/);
  if (trustCoMatch) result.trustCompany = trustCoMatch[1].replace(/\s+/g, " ").trim();

  const trustMatch = text.match(/(?:신탁방식|신탁유형|신탁\s*종류)[:\s]*([^\n]{2,40})/);
  if (trustMatch) result.trustType = trustMatch[1].replace(/\s+/g, " ").trim();
  else if (text.includes("관리형 토지신탁")) result.trustType = "관리형 토지신탁";

  const bizMatch = text.match(/(?:공동주택|오피스텔|지식산업센터|물류센터|오피스)[^\n]{0,60}/);
  if (bizMatch) result.businessDesc = bizMatch[0].replace(/\s+/g, " ").trim();

  const landMatch = text.match(/(?:대지면적)[:\s]*([^\n]{3,40})/);
  if (landMatch) result.landArea = landMatch[1].replace(/\s+/g, " ").trim();
  const bldMatch = text.match(/(?:건축면적)[:\s]*([^\n]{3,40})/);
  if (bldMatch) result.buildingArea = bldMatch[1].replace(/\s+/g, " ").trim();
  const floorMatch = text.match(/(?:전체\s*)?연면적[:\s]*([^\n]{3,40})/);
  if (floorMatch) result.totalFloorArea = floorMatch[1].replace(/\s+/g, " ").trim();
  const scaleMatch = text.match(/(?:건축규모)[:\s]*([^\n]{3,40})/);
  if (scaleMatch) result.buildingScale = scaleMatch[1].replace(/\s+/g, " ").trim();
  const hhMatch = text.match(/(?:세대\s*수|세대수)[:\s]*([^\n]{2,20})/);
  if (hhMatch) result.householdCount = hhMatch[1].replace(/\s+/g, " ").trim();

  if (text.includes("매입이행약정") || text.includes("매입약정")) {
    result.highlights.push("매입이행약정 체결");
  }
  if (text.includes("CM을 통해") || text.includes("CM")) {
    result.highlights.push("CM 월별 공정실사 관리");
  }
  if (text.includes("ESG")) result.highlights.push("ESG 일반사모투자신탁");

  return result;
}

export type ParseProposalResult = {
  parsed: ParsedProposal;
  extractionSource: "gemini" | "regex";
  extractionWarning?: string;
};

/** 파일명에 랩 번호가 있으면 본문/LLM의 펀드번호 오인값을 덮어씀 */
export function lockLabNameFromFileName(
  parsed: ParsedProposal,
  fileName: string
): ParsedProposal {
  const fromFile = extractLabNumber(fileName);
  if (!fromFile) return parsed;
  return { ...parsed, labName: formatLabName(fromFile) };
}

/** 업로드 직후 모달용 — Gemini 없이 빠르게 */
export async function parseProposalQuick(
  rawText: string,
  fileName: string
): Promise<ParseProposalResult> {
  const { sanitizeParsedProposal } = await import(
    "@/lib/analyzers/proposal-sanitize"
  );
  const base = sanitizeParsedProposal(parseProposalText(rawText, fileName));
  return {
    parsed: lockLabNameFromFileName(base, fileName),
    extractionSource: "regex",
    extractionWarning: "조건 상세는 반영 시 Gemini로 보강합니다.",
  };
}

/** 규칙 파싱 + Gemini(사용자 프롬프트) 주추출 */
export async function parseProposal(
  rawText: string,
  fileName: string
): Promise<ParseProposalResult> {
  const base = parseProposalText(rawText, fileName);
  try {
    const { enrichProposalWithLlm } = await import("@/lib/analyzers/proposal-llm");
    const { parsed, meta } = await enrichProposalWithLlm(base, rawText, fileName);
    return {
      parsed: lockLabNameFromFileName(parsed, fileName),
      extractionSource: meta.source,
      extractionWarning: meta.warning,
    };
  } catch {
    const { sanitizeParsedProposal } = await import(
      "@/lib/analyzers/proposal-sanitize"
    );
    return {
      parsed: lockLabNameFromFileName(sanitizeParsedProposal(base), fileName),
      extractionSource: "regex",
      extractionWarning: "제안서 추출 중 오류 — 규칙만 사용됨.",
    };
  }
}
