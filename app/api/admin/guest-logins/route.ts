import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth/session";
import { listGuestLoginLogs } from "@/lib/auth/guest-login-log";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "관리자만 조회할 수 있습니다." }, { status: 403 });
  }

  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 200;
  const result = await listGuestLoginLogs(limit);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
