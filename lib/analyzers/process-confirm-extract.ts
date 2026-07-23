/**
 * 공정확인서(1~2장, 스캔 PDF 포함) — 계획/실적/달성률·확인일 Gemini 추출
 */
import { getChatModel, isGeminiConfigured } from "@/lib/rag/gemini";

const ISO = /^(20\d{2})-(\d{2})-(\d{2})$/;

export type ProcessConfirmExtract = {
  plannedProgressPct: number | null;
  actualProgressPct: number | null;
  achievementPct: number | null;
  reportDate: string | null;
  warning?: string;
};

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (ISO.test(s)) return s;
  const m = s.match(/(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  return null;
}

/** 텍스트 레이어가 거의 없는 스캔 공정확인서인지 */
export function looksLikeScannedProcessConfirm(
  fileName: string,
  pdfText: string
): boolean {
  const n = fileName.normalize("NFC");
  if (!/공정\s*확인|공정확인/.test(n)) return false;
  const meaningful = pdfText
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
    .replace(/\s+/g, "")
    .length;
  return meaningful < 80;
}

export async function extractProcessConfirmFromPdf(
  buffer: Buffer,
  fileName: string
): Promise<ProcessConfirmExtract> {
  if (!isGeminiConfigured()) {
    return {
      plannedProgressPct: null,
      actualProgressPct: null,
      achievementPct: null,
      reportDate: null,
      warning:
        "공정확인서 스캔본은 GEMINI_API_KEY가 있어야 표(계획/실적/달성률)와 확인일을 읽을 수 있습니다.",
    };
  }

  try {
    const model = getChatModel();
    const result = await model.generateContent([
      {
        text: [
          `파일명: ${fileName}`,
          "이 PDF는 건설 현장 「공정확인서」(보통 1~2장)입니다.",
          "표에서 누계 기준의 계획(%), 실행/실적(%), 달성률 또는 대비(%)를 찾으세요.",
          "표 바로 아래(또는 서명란)의 확인일·작성일을 YYYY-MM-DD로 찾으세요.",
          "JSON만 한 줄로 답하세요. 키: planned, actual, achievement, date",
          '예: {"planned":55.28,"actual":62.38,"achievement":112.85,"date":"2026-06-30"}',
          "없으면 해당 값은 null. 추측하지 마세요.",
        ].join("\n"),
      },
      {
        inlineData: {
          mimeType: "application/pdf",
          data: buffer.toString("base64"),
        },
      },
    ]);
    const raw = (result.response.text() ?? "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        plannedProgressPct: null,
        actualProgressPct: null,
        achievementPct: null,
        reportDate: null,
        warning: `공정확인서 인식 실패: ${raw.slice(0, 100)}`,
      };
    }
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return {
      plannedProgressPct: numOrNull(parsed.planned),
      actualProgressPct: numOrNull(parsed.actual),
      achievementPct: numOrNull(parsed.achievement),
      reportDate: parseDate(parsed.date),
    };
  } catch (err) {
    return {
      plannedProgressPct: null,
      actualProgressPct: null,
      achievementPct: null,
      reportDate: null,
      warning: `공정확인서 인식 오류: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}

/** 추출 결과를 파서가 읽는 합성 텍스트로 붙임 */
export function injectProcessConfirmExtract(
  pdfText: string,
  extracted: ProcessConfirmExtract
): string {
  const lines: string[] = [];
  if (extracted.reportDate) {
    const [y, m, d] = extracted.reportDate.split("-");
    lines.push(`일자 ${y}년 ${Number(m)}월 ${Number(d)}일`);
  }
  if (
    extracted.plannedProgressPct != null ||
    extracted.actualProgressPct != null
  ) {
    lines.push(
      `공정현황 계획(%) 실적(%) ${extracted.plannedProgressPct ?? 0}% ${extracted.actualProgressPct ?? 0}%`
    );
  }
  if (extracted.achievementPct != null) {
    lines.push(`대비(%) ${extracted.achievementPct}%`);
  }
  if (lines.length === 0) return pdfText;
  return `${lines.join("\n")}\n${pdfText}`;
}
