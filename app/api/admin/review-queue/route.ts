import { NextRequest, NextResponse } from "next/server";
import {
  listReviewQueue,
  resolveReviewByDocumentId,
  updateReviewQueueStatus,
} from "@/lib/data/review-queue";
import type { ReviewQueueStatus } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const status = (req.nextUrl.searchParams.get("status") ??
      "pending") as ReviewQueueStatus;
    const items = await listReviewQueue(status);
    return NextResponse.json(items);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "검토 대기함 조회 실패" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id?: string;
      status?: ReviewQueueStatus;
      documentId?: string;
    };

    if (body.documentId) {
      await resolveReviewByDocumentId(body.documentId);
      return NextResponse.json({ ok: true });
    }

    if (!body.id || !body.status) {
      return NextResponse.json({ error: "id and status required" }, { status: 400 });
    }

    const item = await updateReviewQueueStatus(body.id, body.status);
    if (!item) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "상태 변경 실패" },
      { status: 500 }
    );
  }
}
