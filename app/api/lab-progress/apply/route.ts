import { NextRequest, NextResponse } from "next/server";
import {
  applyLabProgressRow,
  bindLabProgressToFund,
} from "@/lib/data/lab-progress";
import { resolveReviewByDocumentId } from "@/lib/data/review-queue";
import type { LabProgressRow } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      row?: LabProgressRow;
      labFundId?: string;
      force?: boolean;
    };
    if (!body.row) {
      return NextResponse.json({ error: "row required" }, { status: 400 });
    }

    const result = body.labFundId
      ? await bindLabProgressToFund({
          row: body.row,
          labFundId: body.labFundId,
          force: body.force === true,
        })
      : await applyLabProgressRow(body.row, { force: body.force === true });

    if (
      body.row.documentId &&
      (result.action === "created" || result.action === "updated")
    ) {
      await resolveReviewByDocumentId(body.row.documentId);
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "공정율 반영 실패" },
      { status: 500 }
    );
  }
}
