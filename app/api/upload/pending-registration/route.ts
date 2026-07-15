import { NextRequest, NextResponse } from "next/server";
import { buildProposalRegistrationPrompt } from "@/lib/upload/proposal-registration";
import { getPendingProposal } from "@/lib/data/pending-proposals";

/** 업로드 응답에서 registration을 놓쳤을 때 모달 복구용 */
export async function GET(req: NextRequest) {
  const documentId = req.nextUrl.searchParams.get("documentId");
  if (!documentId) {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }

  const pending = getPendingProposal(documentId);
  if (!pending) {
    return NextResponse.json({ registration: null });
  }

  return NextResponse.json({
    registration: buildProposalRegistrationPrompt({
      documentId: pending.documentId,
      fileName: pending.fileName,
      parsed: pending.parsed,
    }),
  });
}
