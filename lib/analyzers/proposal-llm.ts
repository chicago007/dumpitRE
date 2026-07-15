import type { ParsedProposal } from "@/lib/analyzers/proposal";
import { sanitizeParsedProposal } from "@/lib/analyzers/proposal-sanitize";
import { getChatModel, getChatModelName, isGeminiConfigured } from "@/lib/rag/gemini";

export type ProposalExtractionMeta = {
  source: "gemini" | "regex";
  model?: string;
  warning?: string;
};

/** 규칙 파서는 폴백 — Gemini 값이 있으면 그쪽을 우선 */
function preferLlm<T>(regexVal: T, llmVal: T | null | undefined): T {
  if (llmVal == null || llmVal === "" || llmVal === "확인 불가") return regexVal;
  return llmVal as T;
}

function parseRate(v: unknown): number | null {
  if (v == null || v === "" || v === "확인 불가") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v > 1 && v <= 100 ? v : v * 100;
  const m = String(v).replace(/%/g, "").match(/([\d.]+)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return n > 0 && n < 1 ? n * 100 : n;
}

function nullIfUnavailable(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "확인 불가" || s === "확인불가" || s === "-" || s === "—") return null;
  return s;
}

type LlmConditions = {
  purchaseAgency?: string | null;
  setupDate?: string | null;
  loanMaturityDate?: string | null;
  maturityDate?: string | null;
  interestRate?: string | number | null;
  feeRate?: string | number | null;
  trustCompany?: string | null;
  developer?: string | null;
  contractor?: string | null;
  trustType?: string | null;
  businessDesc?: string | null;
  location?: string | null;
  landArea?: string | null;
  buildingArea?: string | null;
  totalFloorArea?: string | null;
  buildingScale?: string | null;
  householdCount?: string | null;
  labName?: string | null;
  fundName?: string | null;
  siteName?: string | null;
  totalBudgetEok?: number | null;
};

/** 사용자 제공 추출 프롬프트 (Gemini 주추출) */
const USER_EXTRACTION_PROMPT = `역할: 부동산 및 사모펀드 투자제안서 분석 전문가

지침:
제공되는 투자제안서 텍스트에서 아래의 규칙에 따라 "투자 주요 조건"을 추출하여 지정된 형식으로 작성해 주세요. 텍스트 내에서 해당 항목을 찾을 수 없는 경우 "확인 불가"로 표시해 주세요.

[추출 규칙 및 기준]
1. 매입기관 : 금융구조도나 본문에서 "SH", "GH", "LH" 중 매입약정을 체결한 기관 한 곳을 찾아 작성합니다.
2. 설정일 : 펀드개요/표에서 "펀드설정일" 항목의 날짜를 추출합니다.
3. 대출만기일 : "대출만기일" 항목의 날짜를 추출합니다.
4. 펀드만기일 : "펀드만기" 또는 "펀드만기일" 기간(예: 시작일~종료일) 중 "마지막 날짜(종료일)"만 추출합니다.
5. 금리 : "목표수익률" 항목에 기재된 이율을 추출합니다.
6. 수수료율 : 보수 내역 중 "운용사특별용역보수" 항목의 요율을 추출합니다.
7. 신탁사 / 시행사 / 시공사 : 금융구조도나 대출주요조건 표에 기재된 각 주체의 정확한 회사명을 추출합니다.
8. 신탁방식 : 금융구조도나 사업 개요 등에 언급된 신탁 종류(예: "관리형 토지신탁" 등)을 추출합니다.
9. 사업내용 : 투자대상 설명 부분에서 주소(소재지) 뒷부분에 나오는 구체적인 사업 유형(예: "공동주택~"으로 시작하는 부분)을 추출합니다.
10. 사업장 주소 : 건축개요의 "사업장 소재지" 또는 "대지위치"를 추출합니다.
11. 면적 : 건축개요 표에서 "대지면적(평)", "건축면적(평)", "연면적(평/전체연면적)" 값을 평수와 제곱미터(㎡)를 함께 추출합니다.
12. 건축규모 : 건축개요 표의 "건축규모"와 "세대수" 항목을 각각 추출합니다.
13. 랩명/펀드명 : 표지·제목·본건 투자대상에 나온 "부동산랩 N호" 및 해당 건 전용 펀드명만 추출합니다.
14. **중요** : 문서 뒤쪽 '포트폴리오', '투자실적', '기존 사업장' 등 **다른 랩/다른 사업장** 소개 슬라이드의 주소·펀드명은 **절대 사용하지 마세요**. 본건(대상 랩) 조건 표·건축개요·금융구조도만 근거로 하세요.

위 결과를 반드시 아래 JSON 한 개로만 출력하세요.
찾지 못한 필드는 null.
날짜는 가능하면 YYYY-MM-DD.
금리는 숫자(연 %), 수수료율도 숫자(연 %).
면적은 평·㎡를 포함한 한 문자열.
{
  "purchaseAgency": string|null,
  "setupDate": string|null,
  "loanMaturityDate": string|null,
  "maturityDate": string|null,
  "interestRate": number|null,
  "feeRate": number|null,
  "trustCompany": string|null,
  "developer": string|null,
  "contractor": string|null,
  "trustType": string|null,
  "businessDesc": string|null,
  "location": string|null,
  "landArea": string|null,
  "buildingArea": string|null,
  "totalFloorArea": string|null,
  "buildingScale": string|null,
  "householdCount": string|null,
  "labName": string|null,
  "fundName": string|null,
  "siteName": string|null,
  "totalBudgetEok": number|null
}`;

/**
 * Gemini + 사용자 프롬프트로 주추출.
 * 실패 시 source=regex 와 warning 반환.
 */
export async function enrichProposalWithLlm(
  base: ParsedProposal,
  pdfText: string,
  fileName?: string
): Promise<{ parsed: ParsedProposal; meta: ProposalExtractionMeta }> {
  if (!isGeminiConfigured()) {
    return {
      parsed: sanitizeParsedProposal(base),
      meta: {
        source: "regex",
        warning: "Gemini API 키 없음 — 규칙 추출만 사용됨 (사용자 프롬프트 미적용).",
      },
    };
  }
  if (pdfText.trim().length < 80) {
    return {
      parsed: sanitizeParsedProposal(base),
      meta: {
        source: "regex",
        warning: "PDF 텍스트가 거의 없어 Gemini 추출을 건너뜀.",
      },
    };
  }

  const modelName = getChatModelName();
  const model = getChatModel();
  // 앞부분(본건 조건) 위주 — 뒤쪽 포트폴리오 슬라이드는 다른 사업장 예시가 섞임
  const excerpt = pdfText.slice(0, 18000);

  const targetHint = [
    base.labName ? `대상 랩(본건): ${base.labName}` : null,
    fileName ? `파일명: ${fileName}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `${USER_EXTRACTION_PROMPT}

${targetHint ? `${targetHint}\n` : ""}
텍스트:
${excerpt}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });
    const raw = result.response.text().trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        parsed: sanitizeParsedProposal(base),
        meta: {
          source: "regex",
          model: modelName,
          warning: `Gemini(${modelName}) 응답에 JSON 없음 — 규칙 추출로 대체.`,
        },
      };
    }
    const parsed = JSON.parse(jsonMatch[0]) as LlmConditions;

    const budgetFromLlm =
      parsed.totalBudgetEok != null && Number.isFinite(Number(parsed.totalBudgetEok))
        ? Number(parsed.totalBudgetEok) * 100_000_000
        : null;

    const merged: ParsedProposal = {
      siteName: preferLlm(base.siteName, nullIfUnavailable(parsed.siteName)),
      fundName: preferLlm(base.fundName, nullIfUnavailable(parsed.fundName)),
      labName: preferLlm(base.labName, nullIfUnavailable(parsed.labName)),
      totalBudget: preferLlm(base.totalBudget, budgetFromLlm),
      constructionPeriod: base.constructionPeriod,
      location: preferLlm(base.location, nullIfUnavailable(parsed.location)),
      setupDate: preferLlm(base.setupDate, nullIfUnavailable(parsed.setupDate)),
      maturityDate: preferLlm(base.maturityDate, nullIfUnavailable(parsed.maturityDate)),
      loanMaturityDate: preferLlm(
        base.loanMaturityDate,
        nullIfUnavailable(parsed.loanMaturityDate)
      ),
      interestRate: preferLlm(base.interestRate, parseRate(parsed.interestRate)),
      feeRate: preferLlm(base.feeRate, parseRate(parsed.feeRate)),
      purchaseAgency: preferLlm(
        base.purchaseAgency,
        nullIfUnavailable(parsed.purchaseAgency)
      ),
      developer: preferLlm(base.developer, nullIfUnavailable(parsed.developer)),
      contractor: preferLlm(base.contractor, nullIfUnavailable(parsed.contractor)),
      trustCompany: preferLlm(
        base.trustCompany,
        nullIfUnavailable(parsed.trustCompany)
      ),
      trustType: preferLlm(base.trustType, nullIfUnavailable(parsed.trustType)),
      businessDesc: preferLlm(
        base.businessDesc,
        nullIfUnavailable(parsed.businessDesc)
      ),
      landArea: preferLlm(base.landArea, nullIfUnavailable(parsed.landArea)),
      buildingArea: preferLlm(
        base.buildingArea,
        nullIfUnavailable(parsed.buildingArea)
      ),
      totalFloorArea: preferLlm(
        base.totalFloorArea,
        nullIfUnavailable(parsed.totalFloorArea)
      ),
      buildingScale: preferLlm(
        base.buildingScale,
        nullIfUnavailable(parsed.buildingScale)
      ),
      householdCount: preferLlm(
        base.householdCount,
        nullIfUnavailable(parsed.householdCount)
      ),
      highlights: base.highlights,
    };
    return {
      parsed: sanitizeParsedProposal(merged),
      meta: {
        source: "gemini",
        model: modelName,
      },
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn("[proposal-llm] enrich skipped:", err);
    return {
      parsed: sanitizeParsedProposal(base),
      meta: {
        source: "regex",
        model: modelName,
        warning: `Gemini 추출 실패(사용자 프롬프트 미적용) — 규칙만 사용. ${detail.slice(0, 180)}`,
      },
    };
  }
}
