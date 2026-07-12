import { NextRequest, NextResponse } from "next/server";
import {
  inferDocumentType,
  parseCostCmReport,
  resolveSiteId,
} from "@/lib/analyzers/progress-report";
import { parseProposalText } from "@/lib/analyzers/proposal";
import { extractPdfText } from "@/lib/analyzers/pdf-extract";
import {
  createDocument,
  indexDocumentText,
  persistCostCmReport,
  persistProposal,
} from "@/lib/data/repository";
import { sites } from "@/lib/data/seed";
import { uploadToGoogleDrive } from "@/lib/google-drive/client";
import { saveUploadLocally } from "@/lib/storage/local";
import type { DocumentRecord, DocumentType } from "@/lib/types";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const typeParam = (form.get("type") as DocumentType) || "other";

  if (!file) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const docId = crypto.randomUUID();
  const inferredType =
    typeParam !== "other" ? typeParam : inferDocumentType(file.name);

  let analysisStatus: DocumentRecord["analysisStatus"] = "processing";
  let siteId: string | null = null;
  let siteName: string | null = null;
  let googleDriveUrl: string | null = null;
  let googleDriveFileId: string | null = null;
  const applied: string[] = [];
  const warnings: string[] = [];
  let chunkCount = 0;

  try {
    await saveUploadLocally(file.name, buffer);

    if (file.name.endsWith(".pdf") || file.type === "application/pdf") {
      const pdfText = await extractPdfText(buffer);

      if (inferredType === "progress_report") {
        const parsed = parseCostCmReport(pdfText, file.name);
        siteId = resolveSiteId(parsed.siteName, file.name);
        siteName = parsed.siteName ?? (siteId ? sites.find((s) => s.id === siteId)?.name ?? null : null);

        const result = await persistCostCmReport(siteId, parsed, docId);
        applied.push(...result.applied);
        warnings.push(...result.warnings);

        if (!siteId) analysisStatus = "needs_review";
        else if (parsed.overallProgressPct == null) {
          analysisStatus = "needs_review";
          warnings.push("공정율 추출 실패");
        } else {
          analysisStatus = "done";
        }

        if (pdfText.length > 100) {
          chunkCount = await indexDocumentText(docId, siteId, pdfText);
          if (chunkCount > 0) applied.push(`RAG ${chunkCount}청크`);
        }
      } else if (inferredType === "proposal") {
        const parsed = parseProposalText(pdfText, file.name);
        siteId = resolveSiteId(parsed.siteName, file.name);
        siteName = parsed.siteName;

        const result = await persistProposal(siteId, parsed);
        applied.push(...result.applied);
        warnings.push(...result.warnings);
        analysisStatus = siteId ? "done" : "needs_review";

        if (pdfText.length > 100) {
          chunkCount = await indexDocumentText(docId, siteId, pdfText);
          if (chunkCount > 0) applied.push(`RAG ${chunkCount}청크`);
        }
      } else {
        siteId = resolveSiteId(null, file.name);
        siteName = siteId ? sites.find((s) => s.id === siteId)?.name ?? null : null;
        analysisStatus = siteId ? "done" : "needs_review";
      }
    } else {
      siteId = resolveSiteId(null, file.name);
      siteName = siteId ? sites.find((s) => s.id === siteId)?.name ?? null : null;
      analysisStatus = siteId ? "done" : "pending";
      warnings.push("Excel 파서는 추후 지원");
    }

    const driveResult = await uploadToGoogleDrive(file.name, buffer, {
      siteName: siteName ?? undefined,
      docType: inferredType,
    });
    if (driveResult) {
      googleDriveUrl = driveResult.webViewLink;
      googleDriveFileId = driveResult.fileId;
      applied.push("Google Drive");
    }
  } catch (err) {
    analysisStatus = "failed";
    warnings.push(err instanceof Error ? err.message : "분석 중 오류");
  }

  const doc: DocumentRecord = {
    id: docId,
    siteId,
    siteName,
    type: inferredType,
    fileName: file.name,
    analysisStatus,
    uploadedAt: new Date().toISOString(),
    googleDriveUrl,
  };

  await createDocument({ ...doc, googleDriveFileId });

  return NextResponse.json({
    ok: analysisStatus !== "failed",
    document: doc,
    applied,
    warnings,
    chunkCount,
    message:
      analysisStatus === "done"
        ? `분석 완료: ${applied.join(", ") || "저장됨"}`
        : analysisStatus === "needs_review"
          ? "분석 완료 — 검수 필요"
          : analysisStatus === "failed"
            ? "분석 실패"
            : "업로드 완료",
  });
}
