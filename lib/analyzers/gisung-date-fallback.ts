/**
 * 기성보고서 표지 일자가 텍스트 레이어에서 깨진 경우(null byte로 숫자 소실)
 * Gemini에 PDF를 보내 확인일만 복구.
 */
import { getChatModel, isGeminiConfigured } from "@/lib/rag/gemini";

const ISO = /^(20\d{2})-(\d{2})-(\d{2})$/;

export async function extractGisungDateFromPdf(
  buffer: Buffer,
  fileName: string
): Promise<{ date: string | null; warning?: string }> {
  if (!isGeminiConfigured()) {
    return {
      date: null,
      warning:
        "확인일 숫자가 PDF 텍스트에서 깨져 있습니다. GEMINI_API_KEY가 있으면 표지 일자를 복구할 수 있습니다.",
    };
  }

  try {
    const model = getChatModel();
    // 바이트 단위 잘라내면 PDF 구조가 깨져 Gemini가 "no pages" 오류를 낸다.
    // 표지는 앞쪽에 있으므로 전체 PDF를 보낸다 (일반 기성보고서 ~10MB 이하).
    const pdfForGemini = buffer;
    const result = await model.generateContent([
      {
        text: [
          `파일명: ${fileName}`,
          "기성실사보고서/공정확인서 PDF입니다.",
          "표지(문서번호·일자·수신) 또는 서명란의 '일자'/'작성일'/'확인일'을 찾으세요.",
          "YYYY-MM-DD 한 줄만 답하세요. 공사기간·마일스톤 날짜는 쓰지 마세요.",
          "없으면 NONE",
        ].join("\n"),
      },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfForGemini.toString("base64"),
        },
      },
    ]);
    const raw = (result.response.text() ?? "").trim();
    const line = raw.split(/\s+/)[0]?.replace(/[^0-9\-]/g, "") ?? "";
    if (ISO.test(line)) return { date: line };
    const m = raw.match(/(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);
    if (m) {
      return {
        date: `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`,
      };
    }
    return { date: null, warning: `확인일 복구 실패: ${raw.slice(0, 80)}` };
  } catch (err) {
    return {
      date: null,
      warning: `확인일 복구 오류: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}

/** 표지 일자는 있는데 연월일 숫자가 비었는지 (공사기간 ISO 날짜는 무시) */
export function looksLikeBrokenCoverDate(text: string): boolean {
  const t = text.replace(/\0/g, " ");
  // 표지: "일자:" 직후에 연도가 없고, 서명란 "년 월 일"만 남은 경우
  const coverBroken =
    /일\s*자\s*[:：]\s*(?:수\s*신|수신|\n)/.test(t) ||
    /일\s*자\s*[:：]\s*$/m.test(t);
  const stampBroken = /(?:COST|대표|이사).{0,80}년\s*월\s*일/.test(t);
  const hasKoreanYmd = /\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/.test(t);
  return (coverBroken || stampBroken) && !hasKoreanYmd;
}
