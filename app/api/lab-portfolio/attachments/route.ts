import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { getSessionUser, isAdmin } from "@/lib/auth/session";
import {
  addLabFundProgressAttachment,
  getLabPortfolio,
  removeLabFundProgressAttachment,
} from "@/lib/data/lab-portfolio";
import { isGoogleDriveConfigured, uploadToGoogleDrive } from "@/lib/google-drive/client";
import type { ProgressAttachment } from "@/lib/types";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function mimeFromName(fileName: string, fallback: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return fallback || "application/octet-stream";
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "관리자만 첨부할 수 있습니다." }, { status: 403 });
  }

  const form = await req.formData();
  const fundId = String(form.get("fundId") ?? "");
  const file = form.get("file") as File | null;
  if (!fundId || !file) {
    return NextResponse.json({ error: "fundId and file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "파일은 20MB 이하여야 합니다." }, { status: 400 });
  }

  const mime = mimeFromName(file.name, file.type || "");
  if (!ALLOWED.has(mime) && !ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "PDF 또는 이미지(png/jpg/webp/gif)만 첨부할 수 있습니다." },
      { status: 400 }
    );
  }

  const portfolio = await getLabPortfolio();
  const fund = portfolio?.funds.find((f) => f.id === fundId);
  if (!fund) {
    return NextResponse.json({ error: "랩을 찾을 수 없습니다." }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim() || "attachment.bin";

  let url = "";
  let driveFileId: string | null = null;
  let localPath: string | null = null;

  if (isGoogleDriveConfigured()) {
    try {
      const drive = await uploadToGoogleDrive(safeName, buffer, {
        siteName: fund.name,
        docType: "progress_report",
      });
      if (drive) {
        url = drive.webViewLink;
        driveFileId = drive.fileId;
      }
    } catch (err) {
      console.warn("[progress-attachment] drive upload failed:", err);
    }
  }

  if (!url) {
    const dir = path.join(process.cwd(), "uploads", "progress", fundId);
    await mkdir(dir, { recursive: true });
    const stored = `${id}_${safeName}`;
    await writeFile(path.join(dir, stored), buffer);
    localPath = path.join("progress", fundId, stored);
    url = `/api/lab-portfolio/attachments/file?fundId=${encodeURIComponent(fundId)}&attachmentId=${encodeURIComponent(id)}`;
  }

  const attachment: ProgressAttachment = {
    id,
    fileName: safeName,
    mimeType: mime,
    url,
    driveFileId,
    localPath,
    uploadedAt: new Date().toISOString(),
  };

  try {
    const updated = await addLabFundProgressAttachment(fundId, attachment);
    if (!updated) {
      return NextResponse.json({ error: "첨부 저장 실패" }, { status: 500 });
    }
    return NextResponse.json({
      fund: updated,
      attachment,
      storage: driveFileId ? "drive" : "local",
      warning: driveFileId
        ? undefined
        : isGoogleDriveConfigured()
          ? "Google Drive 업로드 실패로 서버에 임시 저장했습니다. /admin/drive 연결을 확인해 주세요."
          : "Google Drive 미연결 — 서버에 임시 저장했습니다. /admin/drive 에서 OAuth 연결하세요.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/progress_attachments|42703/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "DB에 progress_attachments 컬럼이 없습니다. supabase/migrations/008_progress_attachments.sql 을 실행해 주세요.",
        },
        { status: 500 }
      );
    }
    console.error("[progress-attachment] save failed:", err);
    return NextResponse.json({ error: "첨부 저장 실패" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "관리자만 삭제할 수 있습니다." }, { status: 403 });
  }
  const body = (await req.json()) as { fundId?: string; attachmentId?: string };
  if (!body.fundId || !body.attachmentId) {
    return NextResponse.json({ error: "fundId and attachmentId required" }, { status: 400 });
  }
  const updated = await removeLabFundProgressAttachment(body.fundId, body.attachmentId);
  if (!updated) {
    return NextResponse.json({ error: "랩을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ fund: updated });
}
