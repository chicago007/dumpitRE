/**
 * 이미지(PNG/JPG) → 텍스트 (Gemini Vision). 미설정 시 빈 문자열.
 */
import { getChatModel, isGeminiConfigured } from "@/lib/rag/gemini";

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function isImageFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return Object.keys(IMAGE_MIME).some((ext) => lower.endsWith(ext));
}

export function imageMimeFromFileName(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  for (const [ext, mime] of Object.entries(IMAGE_MIME)) {
    if (lower.endsWith(ext)) return mime;
  }
  return null;
}

export async function extractImageText(
  buffer: Buffer,
  fileName: string,
  mimeType?: string | null
): Promise<{ text: string; source: "gemini" | "none"; warning?: string }> {
  const mime = mimeType || imageMimeFromFileName(fileName);
  if (!mime) {
    return { text: "", source: "none", warning: "지원하지 않는 이미지 형식입니다." };
  }
  if (!isGeminiConfigured()) {
    return {
      text: "",
      source: "none",
      warning:
        "PNG/JPG는 텍스트 레이어가 없어 Gemini API(GEMINI_API_KEY)가 필요합니다. 파일명만으로 필증 종류를 인식합니다.",
    };
  }

  try {
    const model = getChatModel();
    const result = await model.generateContent([
      {
        text: [
          "이 이미지는 건설/부동산 관련 행정 서류(인허가 필증, 사업계획 필증, 착공 필증 등)일 수 있습니다.",
          "보이는 한국어·숫자 텍스트를 가능한 한 모두 추출하세요.",
          "문서 종류, 발급/승인/착공 일자, 주소, 사업자명이 있으면 포함하세요.",
          "추측하지 말고 보이는 내용만 적으세요.",
        ].join("\n"),
      },
      {
        inlineData: {
          mimeType: mime,
          data: buffer.toString("base64"),
        },
      },
    ]);
    const text = result.response.text()?.trim() ?? "";
    return { text, source: "gemini" };
  } catch (err) {
    return {
      text: "",
      source: "none",
      warning: `이미지 인식 실패: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}
