import { PDFParse } from "pdf-parse";

/** PDF 텍스트 정규화 — null byte·연속 공백 제거 */
export function normalizePdfText(raw: string): string {
  return raw
    .replace(/\0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return normalizePdfText(result.text);
  } finally {
    await parser.destroy();
  }
}
