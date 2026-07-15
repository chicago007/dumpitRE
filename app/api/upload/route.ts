import { NextRequest, NextResponse } from "next/server";
import {
  inferDocumentType,
  parseCostCmReport,
  resolveSiteId,
} from "@/lib/analyzers/progress-report";
import { parseProposalQuick } from "@/lib/analyzers/proposal";
import {
  buildProposalRegistrationPrompt,
  shouldTreatAsProposal,
} from "@/lib/upload/proposal-registration";
import {
  isLabStatusExcelFile,
  parseLabStatusExcel,
} from "@/lib/analyzers/lab-status-excel";
import { extractPdfText } from "@/lib/analyzers/pdf-extract";
import {
  createDocument,
  indexDocumentText,
  persistCostCmReport,
} from "@/lib/data/repository";
import { getLabPortfolio, setLabPortfolio } from "@/lib/data/lab-portfolio";
import { savePendingProposal } from "@/lib/data/pending-proposals";
import { sites } from "@/lib/data/seed";
import {
  isGoogleDriveConfigured,
  uploadToGoogleDrive,
} from "@/lib/google-drive/client";
import { saveUploadLocally } from "@/lib/storage/local";
import type { DocumentRecord, DocumentType, ProposalRegistrationPrompt } from "@/lib/types";

function resolveEffectiveType(typeParam: DocumentType, fileName: string, isPdf: boolean): DocumentType {
  if (isPdf && typeParam === "proposal") return "proposal";
  const inferred = inferDocumentType(fileName);
  if (typeParam === "other") return inferred;
  // 파일명에 제안/공정이 분명하면 UI에서 고른 유형보다 추론 우선
  if (
    isPdf &&
    (inferred === "proposal" || inferred === "progress_report") &&
    typeParam !== inferred
  ) {
    return inferred;
  }
  if (isPdf && typeParam === "management_status" && (inferred === "proposal" || inferred === "progress_report")) {
    return inferred;
  }
  return typeParam;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const typeParam = (form.get("type") as DocumentType) || "other";
  if (!file) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const docId = crypto.randomUUID();
  const isPdf = file.name.endsWith(".pdf") || file.type === "application/pdf";
  const inferredType = resolveEffectiveType(typeParam, file.name, isPdf);
  const treatAsProposal = shouldTreatAsProposal(file.name, typeParam, isPdf);

  let analysisStatus: DocumentRecord["analysisStatus"] = "processing";
  let siteId: string | null = null;
  let siteName: string | null = null;
  let googleDriveUrl: string | null = null;
  let googleDriveFileId: string | null = null;
  const applied: string[] = [];
  const warnings: string[] = [];
  let chunkCount = 0;
  let docType: DocumentType = treatAsProposal ? "proposal" : inferredType;
  let registration: ProposalRegistrationPrompt | null = null;
  let pdfTextForIndex = "";

  if (typeParam !== inferredType) {
    warnings.push(`문서 유형을 ‘${inferredType}’(으)로 자동 인식했습니다.`);
  }

  try {
    await saveUploadLocally(file.name, buffer);

    if (isPdf) {
      const pdfText = await extractPdfText(buffer);
      pdfTextForIndex = pdfText;

      if (treatAsProposal) {
        const { parsed, extractionWarning } = await parseProposalQuick(
          pdfText,
          file.name
        );
        if (extractionWarning) warnings.push(extractionWarning);

        savePendingProposal({
          documentId: docId,
          fileName: file.name,
          parsed,
          pdfText: pdfText.slice(0, 120_000),
          createdAt: new Date().toISOString(),
        });
        analysisStatus = "needs_review";
        docType = "proposal";
        warnings.push("신규/기존 부동산랩을 선택한 뒤 반영해 주세요.");
        registration = buildProposalRegistrationPrompt({
          documentId: docId,
          fileName: file.name,
          parsed,
        });
        siteName = parsed.siteName ?? registration.suggestedLabName;
      } else if (inferredType === "progress_report") {
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
      } else {
        siteId = resolveSiteId(null, file.name);
        siteName = siteId ? sites.find((s) => s.id === siteId)?.name ?? null : null;
        analysisStatus = siteId ? "done" : "needs_review";
      }
    } else if (
      inferredType === "management_status" ||
      isLabStatusExcelFile(file.name)
    ) {
      const portfolio = parseLabStatusExcel(buffer, file.name);
      setLabPortfolio(portfolio);
      siteName = "부동산랩 포트폴리오";
      docType = "management_status";
      analysisStatus = "done";
      applied.push(`랩 ${portfolio.stats.totalCount}건`);
      applied.push(`운용 ${portfolio.stats.activeCount}건`);
      applied.push(`상환 ${portfolio.stats.repaidCount}건`);
    } else {
      siteId = resolveSiteId(null, file.name);
      siteName = siteId ? sites.find((s) => s.id === siteId)?.name ?? null : null;
      analysisStatus = siteId ? "done" : "pending";
      warnings.push("Excel 파서는 추후 지원 (관리현황 엑셀은 문서 유형을 ‘관리현황’으로 선택하세요)");
    }
  } catch (err) {
    analysisStatus = "failed";
    warnings.push(err instanceof Error ? err.message : "분석 중 오류");
  }

  // Drive / RAG 는 실패해도 분석 결과를 failed로 바꾸지 않음
  if (analysisStatus === "done" && pdfTextForIndex.length > 100) {
    try {
      chunkCount = await indexDocumentText(docId, siteId, pdfTextForIndex);
      if (chunkCount > 0) applied.push(`RAG ${chunkCount}청크`);
    } catch (err) {
      warnings.push(
        `임베딩 생략: ${err instanceof Error ? err.message : "embedding error"}`
      );
    }
  }

  let driveUpload: { ok: boolean; message: string } = {
    ok: false,
    message: "Google Drive 업로드를 시도하지 못했습니다.",
  };
  if (!isGoogleDriveConfigured()) {
    driveUpload = {
      ok: false,
      message:
        "Google Drive 업로드 안 됨: 환경변수(GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY / DRIVE_ROOT_FOLDER_ID)가 없습니다.",
    };
    warnings.push(driveUpload.message);
  } else {
    try {
      const driveResult = await uploadToGoogleDrive(file.name, buffer, {
        siteName: siteName ?? registration?.suggestedLabName ?? undefined,
        docType: docType,
      });
      if (driveResult) {
        googleDriveUrl = driveResult.webViewLink;
        googleDriveFileId = driveResult.fileId;
        driveUpload = {
          ok: true,
          message: "Google Drive 업로드 완료",
        };
        applied.push(driveUpload.message);
      } else {
        driveUpload = {
          ok: false,
          message:
            "Google Drive 업로드 안 됨: Drive API가 파일을 만들지 못했습니다. 루트 폴더 공유(서비스 계정 편집자)를 확인해 주세요.",
        };
        warnings.push(driveUpload.message);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : "drive error";
      driveUpload = {
        ok: false,
        message: `Google Drive 업로드 안 됨: ${detail}`,
      };
      warnings.push(driveUpload.message);
    }
  }

  const doc: DocumentRecord = {
    id: docId,
    siteId,
    siteName,
    type: docType,
    fileName: file.name,
    analysisStatus,
    uploadedAt: new Date().toISOString(),
    googleDriveUrl,
  };

  try {
    await createDocument({ ...doc, googleDriveFileId });
  } catch (err) {
    warnings.push(
      `문서 메타 저장 실패: ${err instanceof Error ? err.message : "unknown"}`
    );
  }

  const analysisMessage = registration
    ? "신규/기존 부동산랩 선택이 필요합니다"
    : analysisStatus === "done"
      ? docType === "management_status"
        ? `관리현황 반영: ${applied.filter((a) => !a.startsWith("Google Drive")).join(", ") || "저장됨"}`
        : `분석 완료: ${applied.filter((a) => !a.startsWith("Google Drive")).join(", ") || "저장됨"}`
      : analysisStatus === "needs_review"
        ? "분석 완료 — 검수 필요"
        : analysisStatus === "failed"
          ? "분석 실패"
          : "업로드 완료";

  return NextResponse.json({
    ok: analysisStatus !== "failed",
    document: doc,
    applied,
    warnings,
    chunkCount,
    registration,
    requiresRegistration: Boolean(registration),
    driveUpload,
    redirectTo:
      docType === "management_status" && !registration ? "/management" : undefined,
    message: registration
      ? analysisMessage
      : `${analysisMessage}${driveUpload.ok ? "" : `\n${driveUpload.message}`}`,
  });
}
