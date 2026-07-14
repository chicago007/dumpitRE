import { google } from "googleapis";
import { Readable } from "stream";

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  folderId: string;
}

function getPrivateKey(): string {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "";
  return raw.replace(/\\n/g, "\n");
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

export async function ensureSiteFolder(siteName: string): Promise<string | null> {
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
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
  const rootId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  if (!drive || !rootId) return null;

  let parentId = rootId;
  if (options?.siteName) {
    const siteFolder = await ensureSiteFolder(options.siteName);
    if (siteFolder) parentId = siteFolder;
  }

  if (options?.docType) {
    const subName = docTypeSubfolder(options.docType);
    const subQuery = `'${parentId}' in parents and name = '${subName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const subExisting = await drive.files.list({ q: subQuery, fields: "files(id)" });
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
