import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth/session";
import {
  exchangeCodeForTokens,
  getOAuthRedirectUri,
} from "@/lib/google-drive/oauth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return NextResponse.redirect(new URL("/login?next=/admin/drive", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/drive?error=${encodeURIComponent(error)}`, req.url)
    );
  }
  if (!code) {
    return NextResponse.redirect(
      new URL("/admin/drive?error=missing_code", req.url)
    );
  }

  try {
    const redirectUri = getOAuthRedirectUri(req.nextUrl.origin);
    const { email } = await exchangeCodeForTokens(code, redirectUri);
    const q = email ? `?ok=1&email=${encodeURIComponent(email)}` : "?ok=1";
    return NextResponse.redirect(new URL(`/admin/drive${q}`, req.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(
      new URL(`/admin/drive?error=${encodeURIComponent(msg)}`, req.url)
    );
  }
}
