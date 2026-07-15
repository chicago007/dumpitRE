import { google } from "googleapis";
import { Readable } from "stream";

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  folderId: string;
}

function getPrivateKey(): string {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "";
  raw = raw.trim();
  // JSON/dotenv 붙여넣기 잔여물: 따옴표·쉼표
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

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = getPrivateKey();
  if (!email || !key) return null;

  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

function getDrive() {
  const auth = getAuth();
  if (!auth) return null;
  return google.drive({ version: "v3", auth });
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID
  );
}

const folderCache = new Map<string, string>();

function rootFolderId(): string | null {
  const id = (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "").trim().replace(/[.\s]+$/, "");
  return id || null;
}

export async function ensureSiteFolder(siteName: string): Promise<string | null> {
  const rootId = rootFolderId();
  const drive = getDrive();
  if (!rootId || !drive) return null;

  const cacheKey = siteName.slice(0, 80);
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey)!;

  const safeName = siteName.replace(/[\\/:*?"<>|]/g, "_").slice(0, 100);
  const query = `'${rootId}' in parents and name = '${safeName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const existing = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });

  if (existing.data.files?.[0]?.id) {
    folderCache.set(cacheKey, existing.data.files[0].id!);
    return existing.data.files[0].id!;
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
  const drive = getDrive();
  const rootId = rootFolderId();
  if (!drive || !rootId) return null;

  // 루트 폴더 접근 가능 여부 선확인 (공유 누락/잘못된 ID를 바로 안내)
  try {
    await drive.files.get({
      fileId: rootId,
      fields: "id, name",
      supportsAllDrives: true,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    throw new Error(
      `루트 폴더(${rootId})에 접근할 수 없습니다. 서비스 계정에 편집자 공유·폴더 ID를 확인해 주세요. (${detail})`
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
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
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
