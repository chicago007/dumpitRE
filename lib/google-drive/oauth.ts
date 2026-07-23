import fs from "fs";
import path from "path";
import { google } from "googleapis";
import type { Credentials } from "google-auth-library";

/** 기존 dumpitRE 폴더에 쓰려면 drive.file 만으로는 부족 → full drive */
const SCOPES = ["https://www.googleapis.com/auth/drive"];
const TOKEN_PATH = path.join(process.cwd(), ".data", "google-drive-oauth.json");

export type DriveOAuthToken = {
  refresh_token?: string | null;
  access_token?: string | null;
  expiry_date?: number | null;
  email?: string | null;
  updatedAt?: string;
};

function clientId(): string {
  return (process.env.GOOGLE_OAUTH_CLIENT_ID ?? "").trim();
}

function clientSecret(): string {
  return (process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "").trim();
}

export function getOAuthRedirectUri(reqOrigin?: string | null): string {
  const fromEnv = (process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "").trim();
  if (fromEnv) return fromEnv;
  const base = (reqOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  return `${base}/api/google-drive/oauth/callback`;
}

export function isGoogleOAuthClientConfigured(): boolean {
  return Boolean(clientId() && clientSecret());
}

function readTokenFile(): DriveOAuthToken | null {
  try {
    if (!fs.existsSync(TOKEN_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8")) as DriveOAuthToken;
    return raw?.refresh_token ? raw : null;
  } catch {
    return null;
  }
}

function envRefreshToken(): string | null {
  const t = (process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? "").trim();
  return t || null;
}

export function getStoredRefreshToken(): string | null {
  return readTokenFile()?.refresh_token ?? envRefreshToken();
}

export function isGoogleOAuthConnected(): boolean {
  return isGoogleOAuthClientConfigured() && Boolean(getStoredRefreshToken());
}

export function getStoredOAuthMeta(): { email: string | null; updatedAt: string | null } {
  const file = readTokenFile();
  return {
    email: file?.email ?? null,
    updatedAt: file?.updatedAt ?? null,
  };
}

export function saveOAuthTokens(creds: Credentials & { email?: string | null }): void {
  const dir = path.dirname(TOKEN_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const prev = readTokenFile();
  const next: DriveOAuthToken = {
    refresh_token: creds.refresh_token ?? prev?.refresh_token ?? envRefreshToken(),
    access_token: creds.access_token ?? null,
    expiry_date: creds.expiry_date ?? null,
    email: creds.email ?? prev?.email ?? null,
    updatedAt: new Date().toISOString(),
  };
  if (!next.refresh_token) {
    throw new Error("refresh_token 이 없습니다. Google 동의 화면에서 권한을 다시 허용해 주세요.");
  }
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(next, null, 2), "utf8");
}

export function clearOAuthTokens(): void {
  try {
    if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
  } catch {
    /* ignore */
  }
}

export function createOAuth2Client(redirectUri?: string) {
  if (!isGoogleOAuthClientConfigured()) return null;
  return new google.auth.OAuth2(clientId(), clientSecret(), redirectUri ?? getOAuthRedirectUri());
}

export function getOAuthAuthUrl(redirectUri: string, state?: string): string | null {
  const client = createOAuth2Client(redirectUri);
  if (!client) return null;
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: state || undefined,
  });
}

/** 저장된 refresh token으로 Drive 호출용 OAuth2 클라이언트 */
export async function getAuthorizedOAuthClient() {
  const refresh = getStoredRefreshToken();
  if (!refresh || !isGoogleOAuthClientConfigured()) return null;

  const client = createOAuth2Client();
  if (!client) return null;

  const file = readTokenFile();
  client.setCredentials({
    refresh_token: refresh,
    access_token: file?.access_token ?? undefined,
    expiry_date: file?.expiry_date ?? undefined,
  });

  client.on("tokens", (tokens) => {
    try {
      saveOAuthTokens({
        ...tokens,
        refresh_token: tokens.refresh_token ?? refresh,
        email: file?.email,
      });
    } catch (err) {
      console.warn("[google-drive-oauth] token refresh persist failed:", err);
    }
  });

  return client;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const client = createOAuth2Client(redirectUri);
  if (!client) throw new Error("OAuth 클라이언트 미설정");
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  let email: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    email = me.data.email ?? null;
  } catch {
    /* optional */
  }

  saveOAuthTokens({ ...tokens, email });
  return { email, tokens };
}
