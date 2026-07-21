import { NextRequest, NextResponse } from "next/server";
import { authenticate, isGuestUser, setSessionUser } from "@/lib/auth/session";
import { recordGuestLogin } from "@/lib/auth/guest-login-log";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  const user = authenticate(username, password);
  if (!user) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  await setSessionUser(user);

  if (isGuestUser(user)) {
    // 기록 실패해도 로그인은 성공 처리
    void recordGuestLogin({
      userId: user.id,
      username: username.trim().toLowerCase() || "guest",
      headers: req.headers,
    }).catch((err) => console.warn("[guest-login] record failed:", err));
  }

  return NextResponse.json({ user });
}
