import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function saveUploadLocally(
  fileName: string,
  buffer: Buffer
): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const safeName = `${Date.now()}_${fileName.replace(/[^\w.\-가-힣]/g, "_")}`;
  const filePath = path.join(UPLOAD_DIR, safeName);
  await writeFile(filePath, buffer);
  return filePath;
}
