import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth/session";
import {
  getOAuthAuthUrl,
  getOAuthRedirectUri,
  isGoogleOAuthClientConfigured,
} from "@/lib/google-drive/oauth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "관리자만 연결할 수 있습니다." }, { status: 403 });
  }
  if (!isGoogleOAuthClientConfigured()) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET 을 .env.local 에 설정해 주세요.",
      },
      { status: 500 }
    );
  }

  const origin = req.nextUrl.origin;
  const redirectUri = getOAuthRedirectUri(origin);
  const url = getOAuthAuthUrl(redirectUri, "drive");
  if (!url) {
    return NextResponse.json({ error: "OAuth URL 생성 실패" }, { status: 500 });
  }
  return NextResponse.redirect(url);
}
