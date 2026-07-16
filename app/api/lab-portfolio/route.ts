import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth/session";
import {
  getLabPortfolio,
  updateLabFundProgressComment,
} from "@/lib/data/lab-portfolio";

export async function GET() {
  const portfolio = getLabPortfolio();
  return NextResponse.json(portfolio, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "관리자만 수정할 수 있습니다." }, { status: 403 });
  }

  const body = await req.json();
  const fundId = String(body.fundId ?? "");
  const progressComment = String(body.progressComment ?? "");
  if (!fundId) {
    return NextResponse.json({ error: "fundId required" }, { status: 400 });
  }

  const fund = updateLabFundProgressComment(fundId, progressComment);
  if (!fund) {
    return NextResponse.json({ error: "랩을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ fund });
}
