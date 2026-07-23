import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import { getSessionUser } from "@/lib/auth/session";
import { getLabPortfolio } from "@/lib/data/lab-portfolio";
import { downloadFromGoogleDrive } from "@/lib/google-drive/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const fundId = req.nextUrl.searchParams.get("fundId") ?? "";
  const attachmentId = req.nextUrl.searchParams.get("attachmentId") ?? "";
  if (!fundId || !attachmentId) {
    return NextResponse.json({ error: "fundId and attachmentId required" }, { status: 400 });
  }

  const portfolio = await getLabPortfolio();
  const fund = portfolio?.funds.find((f) => f.id === fundId);
  const attachment = fund?.progressAttachments?.find((a) => a.id === attachmentId);
  if (!attachment) {
    return NextResponse.json({ error: "첨부 파일을 찾을 수 없습니다." }, { status: 404 });
  }

  let buf: Buffer | null = null;
  let mime = attachment.mimeType || "application/octet-stream";

  if (attachment.localPath) {
    const abs = path.join(process.cwd(), "uploads", attachment.localPath);
    if (!abs.startsWith(path.join(process.cwd(), "uploads"))) {
      return NextResponse.json({ error: "invalid path" }, { status: 400 });
    }
    try {
      buf = await readFile(abs);
    } catch {
      buf = null;
    }
  }

  if (!buf && attachment.driveFileId) {
    try {
      const drive = await downloadFromGoogleDrive(attachment.driveFileId);
      if (drive) {
        buf = drive.buffer;
        if (drive.mimeType) mime = drive.mimeType;
      }
    } catch (err) {
      console.warn("[progress-attachment] drive download failed:", err);
    }
  }

  if (!buf) {
    return NextResponse.json({ error: "파일 읽기 실패" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
