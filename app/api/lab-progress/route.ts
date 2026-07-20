import { NextRequest, NextResponse } from "next/server";
import {
  deleteLabProgress,
  listLabProgress,
  listLabProgressHistory,
  listLabsMissingProgressForMonth,
  updateLabProgressFields,
} from "@/lib/data/lab-progress";

export async function GET(req: NextRequest) {
  try {
    const missing = req.nextUrl.searchParams.get("missing") === "1";
    if (missing) {
      const month = req.nextUrl.searchParams.get("month") ?? undefined;
      const rows = await listLabsMissingProgressForMonth(month);
      return NextResponse.json(rows);
    }

    const history = req.nextUrl.searchParams.get("history") === "1";
    if (history) {
      const labName = req.nextUrl.searchParams.get("labName") ?? undefined;
      const rows = await listLabProgressHistory(labName);
      return NextResponse.json(rows);
    }

    const rows = await listLabProgress();
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "공정율 목록 조회 실패" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      id?: string;
      patch?: Parameters<typeof updateLabProgressFields>[1];
    };
    if (!body.id || !body.patch) {
      return NextResponse.json({ error: "id and patch required" }, { status: 400 });
    }
    const row = await updateLabProgressFields(body.id, body.patch);
    if (!row) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, row });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "공정율 수정 실패" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const ok = await deleteLabProgress(body.id);
    if (!ok) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "공정율 삭제 실패" },
      { status: 500 }
    );
  }
}
