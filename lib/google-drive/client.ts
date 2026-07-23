import { google } from "googleapis";
import { Readable } from "stream";
import {
  getAuthorizedOAuthClient,
  isGoogleOAuthConnected,
} from "@/lib/google-drive/oauth";

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  folderId: string;
}

function getPrivateKey(): string {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "";
  raw = raw.trim();
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1);
  }
  raw = raw.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
  if (raw.endsWith('",') || raw.endsWith("',")) raw = raw.slice(0, -2).trim();
  if (raw.endsWith('"') || raw.endsWith("'")) raw = raw.slice(0, -1).trim();

  const begin = "-----BEGIN PRIVATE KEY-----";
  const end = "-----END PRIVATE KEY-----";
  const start = raw.indexOf(begin);
  const stop = raw.indexOf(end);
  if (start >= 0 && stop > start) {
    raw = raw.slice(start, stop + end.length).trim() + "\n";
  }
  return raw;
}

function hasServiceAccount(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() && getPrivateKey()
  );
}

function getServiceAccountAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = getPrivateKey();
  if (!email || !key) return null;
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

async function getDrive() {
  // 내 드라이브 업로드: OAuth(사용자) 우선
  const oauth = await getAuthorizedOAuthClient();
  const auth = oauth ?? getServiceAccountAuth();
  if (!auth) return null;
  // googleapis 중복 타입 선언 회피
  return google.drive({ version: "v3", auth: auth as never });
}

export function rootFolderId(): string | null {
  const id = (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "").trim().replace(/[.\s]+$/, "");
  return id || null;
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(rootFolderId() && (isGoogleOAuthConnected() || hasServiceAccount()));
}

export function getGoogleDriveAuthMode(): "oauth" | "service_account" | "none" {
  if (isGoogleOAuthConnected()) return "oauth";
  if (hasServiceAccount() && rootFolderId()) return "service_account";
  return "none";
}

const folderCache = new Map<string, string>();

export async function ensureSiteFolder(siteName: string): Promise<string | null> {
  const rootId = rootFolderId();
  const drive = await getDrive();
  if (!rootId || !drive) return null;

  const cacheKey = siteName.slice(0, 80);
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey)!;

  const safeName = siteName.replace(/[\\/:*?"<>|]/g, "_").slice(0, 100);
  const query = `'${rootId}' in parents and name = '${safeName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const existing = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existingId = existing.data.files?.[0]?.id;
  if (existingId) {
    folderCache.set(cacheKey, existingId);
    return existingId;
  }

  const created = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const folderId = created.data.id!;
  folderCache.set(cacheKey, folderId);
  return folderId;
}

function docTypeSubfolder(type: string): string {
  const map: Record<string, string> = {
    proposal: "01_제안서",
    progress_report: "02_공정율",
    fund_schedule: "03_자금집행",
    management_status: "04_관리현황",
  };
  return map[type] ?? "99_기타";
}

export async function uploadToGoogleDrive(
  fileName: string,
  buffer: Buffer,
  options?: { siteName?: string; docType?: string }
): Promise<DriveUploadResult | null> {
  const drive = await getDrive();
  const rootId = rootFolderId();
  if (!drive || !rootId) return null;

  const mode = getGoogleDriveAuthMode();
  try {
    await drive.files.get({
      fileId: rootId,
      fields: "id, name",
      supportsAllDrives: true,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    throw new Error(
      mode === "oauth"
        ? `루트 폴더(${rootId})에 접근할 수 없습니다. 로그인한 Google 계정 소유/편집 권한과 폴더 ID를 확인해 주세요. (${detail})`
        : `루트 폴더(${rootId})에 접근할 수 없습니다. 서비스 계정 공유·폴더 ID를 확인해 주세요. (${detail})`
    );
  }

  let parentId = rootId;
  const folderLabel = (options?.siteName ?? "").trim() || "미분류";
  const siteFolder = await ensureSiteFolder(folderLabel);
  if (siteFolder) parentId = siteFolder;

  if (options?.docType) {
    const subName = docTypeSubfolder(options.docType);
    const subQuery = `'${parentId}' in parents and name = '${subName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const subExisting = await drive.files.list({
      q: subQuery,
      fields: "files(id)",
      spaces: "drive",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (subExisting.data.files?.[0]?.id) {
      parentId = subExisting.data.files[0].id!;
    } else {
      const subCreated = await drive.files.create({
        requestBody: {
          name: subName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        },
        fields: "id",
        supportsAllDrives: true,
      });
      parentId = subCreated.data.id!;
    }
  }

  const mimeType = fileName.endsWith(".pdf")
    ? "application/pdf"
    : fileName.endsWith(".xlsx")
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : fileName.match(/\.(png|jpe?g|webp|gif)$/i)
        ? `image/${fileName.toLowerCase().endsWith(".jpg") ? "jpeg" : fileName.split(".").pop()!.toLowerCase()}`
        : "application/octet-stream";

  const uploaded = await drive.files.create({
    requestBody: { name: fileName, parents: [parentId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  const fileId = uploaded.data.id!;
  const webViewLink =
    uploaded.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;

  return { fileId, webViewLink, folderId: parentId };
}

export async function downloadFromGoogleDrive(
  fileId: string
): Promise<{ buffer: Buffer; mimeType: string | null } | null> {
  const drive = await getDrive();
  if (!drive || !fileId) return null;

  const meta = await drive.files.get({
    fileId,
    fields: "id, mimeType",
    supportsAllDrives: true,
  });

  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );

  const data = res.data as ArrayBuffer;
  return {
    buffer: Buffer.from(data),
    mimeType: meta.data.mimeType ?? null,
  };
}
