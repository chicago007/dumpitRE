import { NextRequest, NextResponse } from "next/server";
import {
  getPendingProposal,
  savePendingProposal,
} from "@/lib/data/pending-proposals";
import { lockLabNameFromFileName } from "@/lib/analyzers/proposal";
import { stripTemplatePollution } from "@/lib/analyzers/proposal-sanitize";
import { buildProposalRegistrationPrompt } from "@/lib/upload/proposal-registration";
import type { ProposalRegistrationPrompt } from "@/lib/types";

/**
 * 대기 중인 제안서들에 대해 Gemini(사용자 추출 프롬프트)로 조건을 보강.
 * 복수 업로드 비교표용.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const documentIds = Array.isArray(body.documentIds)
    ? body.documentIds.map((id: unknown) => String(id)).filter(Boolean)
    : [];

  if (documentIds.length === 0) {
    return NextResponse.json(
      { error: "documentIds 배열이 필요합니다." },
      { status: 400 }
    );
  }

  const { enrichProposalWithLlm } = await import("@/lib/analyzers/proposal-llm");

  const registrations: ProposalRegistrationPrompt[] = [];
  const errors: { documentId: string; message: string }[] = [];

  for (const documentId of documentIds) {
    const pending = getPendingProposal(documentId);
    if (!pending) {
      errors.push({ documentId, message: "대기 제안서를 찾을 수 없습니다." });
      continue;
    }

    try {
      let parsed = pending.parsed;
      let extractionSource: "gemini" | "regex" = "regex";
      let extractionWarning: string | undefined;

      if (pending.pdfText && pending.pdfText.trim().length >= 80) {
        const { parsed: enriched, meta } = await enrichProposalWithLlm(
          pending.parsed,
          pending.pdfText,
          pending.fileName
        );
        parsed = lockLabNameFromFileName(
          stripTemplatePollution(enriched, enriched.labName ?? pending.parsed.labName),
          pending.fileName
        );
        extractionSource = meta.source;
        extractionWarning = meta.warning;
      } else {
        extractionWarning = "PDF 텍스트가 없어 Gemini 추출을 건너뜀.";
      }

      savePendingProposal({
        ...pending,
        parsed,
      });

      registrations.push(
        await buildProposalRegistrationPrompt({
          documentId,
          fileName: pending.fileName,
          parsed,
          extractionSource,
          extractionWarning,
        })
      );
    } catch (err) {
      errors.push({
        documentId,
        message: err instanceof Error ? err.message : "추출 실패",
      });
      registrations.push(
        await buildProposalRegistrationPrompt({
          documentId,
          fileName: pending.fileName,
          parsed: pending.parsed,
          extractionSource: "regex",
          extractionWarning: "Gemini 추출 실패 — 규칙 추출만 표시합니다.",
        })
      );
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    registrations,
    errors,
  });
}
