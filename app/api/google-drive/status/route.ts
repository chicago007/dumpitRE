import { NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth/session";
import {
  getGoogleDriveAuthMode,
  isGoogleDriveConfigured,
  rootFolderId,
} from "@/lib/google-drive/client";
import {
  clearOAuthTokens,
  getStoredOAuthMeta,
  isGoogleOAuthClientConfigured,
  isGoogleOAuthConnected,
} from "@/lib/google-drive/oauth";

export async function GET() {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "관리자만 조회할 수 있습니다." }, { status: 403 });
  }
  const meta = getStoredOAuthMeta();
  return NextResponse.json({
    oauthClientConfigured: isGoogleOAuthClientConfigured(),
    oauthConnected: isGoogleOAuthConnected(),
    driveReady: isGoogleDriveConfigured(),
    authMode: getGoogleDriveAuthMode(),
    rootFolderId: rootFolderId(),
    email: meta.email,
    updatedAt: meta.updatedAt,
  });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "관리자만 해제할 수 있습니다." }, { status: 403 });
  }
  clearOAuthTokens();
  return NextResponse.json({ ok: true });
}
