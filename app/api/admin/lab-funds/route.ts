import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth/session";
import { buildLabStatusExcelBuffer } from "@/lib/analyzers/lab-status-excel";
import {
  deleteLabFundById,
  getLabPortfolio,
  normalizeInterestPayments,
  updateLabFund,
} from "@/lib/data/lab-portfolio";
import type { LabFund, LabFundStatus } from "@/lib/types";

function requireAdmin() {
  return getSessionUser().then((user) => (isAdmin(user) ? user : null));
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "관리자만 조회할 수 있습니다." }, { status: 403 });
  }

  const format = req.nextUrl.searchParams.get("format");
  const portfolio = getLabPortfolio();
  if (format === "xlsx") {
    const funds = portfolio?.funds ?? [];
    const buf = buildLabStatusExcelBuffer(funds);
    const fileName = `관리현황_마스터_${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  }

  return NextResponse.json(portfolio);
}

export async function PUT(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "관리자만 수정할 수 있습니다." }, { status: 403 });
  }

  const body = await req.json();
  const fundId = String(body.id ?? body.fundId ?? "");
  if (!fundId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s || null;
  };

  const patch: Partial<LabFund> = {};
  const strKeys = [
    "name",
    "fundName",
    "fundCode",
    "productCode",
    "siteAddress",
    "businessDesc",
    "purchaseAgency",
    "trustType",
    "trustCompany",
    "developer",
    "contractor",
    "setupDate",
    "maturityDate",
    "loanMaturityDate",
    "repaymentDate",
    "landArea",
    "buildingArea",
    "totalFloorArea",
    "buildingScale",
    "householdCount",
    "vsPlan",
    "note",
    "progressComment",
  ] as const;
  for (const key of strKeys) {
    if (key in body) {
      if (key === "name") patch.name = str(body.name) ?? "";
      else (patch as Record<string, string | null>)[key] = str(body[key]);
    }
  }
  const numKeys = [
    "setupAmount",
    "balance",
    "interestRate",
    "feeRate",
    "plannedProgressPct",
    "actualProgressPct",
  ] as const;
  for (const key of numKeys) {
    if (key in body) (patch as Record<string, number | null>)[key] = num(body[key]);
  }
  if ("status" in body) {
    const s = String(body.status);
    if (s === "active" || s === "repaid" || s === "unknown") {
      patch.status = s as LabFundStatus;
    }
  }
  if ("interestPayments" in body && Array.isArray(body.interestPayments)) {
    patch.interestPayments = normalizeInterestPayments(body.interestPayments);
  }
  if ("interestDates" in body && typeof body.interestDates === "object") {
    const entries = Object.entries(body.interestDates as Record<string, string>).map(
      ([round, date]) => ({ round: Number(round), date })
    );
    patch.interestPayments = normalizeInterestPayments(entries);
  }

  const fund = updateLabFund(fundId, patch);
  if (!fund) {
    return NextResponse.json({ error: "랩을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ fund, message: "마스터에 저장되었습니다." });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "관리자만 삭제할 수 있습니다." }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const removed = deleteLabFundById(id);
  if (!removed) {
    return NextResponse.json({ error: "랩을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    removed,
    message: `${removed.name} 삭제됨`,
  });
}
