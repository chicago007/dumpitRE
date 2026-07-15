import { NextRequest, NextResponse } from "next/server";
import { authenticate, setSessionUser } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  const user = authenticate(username, password);
  if (!user) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  await setSessionUser(user);
  return NextResponse.json({ user });
}
