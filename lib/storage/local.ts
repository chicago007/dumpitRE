import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

/** macOS NFD 한글 등을 NFC로 맞춘 뒤, 경로에 위험한 문자만 _ 로 치환 */
function sanitizeUploadFileName(fileName: string): string {
  const normalized = fileName.normalize("NFC");
  const base = path.basename(normalized);
  // 한글·영문·숫자·일반 구두점 유지 (슬래시 등 경로문자만 제거)
  return base.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim() || "upload.bin";
}

export async function saveUploadLocally(
  fileName: string,
  buffer: Buffer
): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const safeName = `${Date.now()}_${sanitizeUploadFileName(fileName)}`;
  const filePath = path.join(UPLOAD_DIR, safeName);
  await writeFile(filePath, buffer);
  return filePath;
}
