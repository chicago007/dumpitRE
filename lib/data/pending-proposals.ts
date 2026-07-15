import fs from "fs";
import path from "path";
import type { ParsedProposal } from "@/lib/analyzers/proposal";

export interface PendingProposal {
  documentId: string;
  fileName: string;
  parsed: ParsedProposal;
  /** Gemini 재추출용 (업로드 시에는 빠른 규칙 파싱만 하고 확인 시 사용) */
  pdfText?: string;
  createdAt: string;
}

const PENDING_PATH = path.join(process.cwd(), ".data", "pending-proposals.json");
const pending = new Map<string, PendingProposal>();
let loaded = false;

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    if (!fs.existsSync(PENDING_PATH)) return;
    const raw = JSON.parse(fs.readFileSync(PENDING_PATH, "utf8")) as Record<
      string,
      PendingProposal
    >;
    for (const [id, item] of Object.entries(raw)) {
      if (item?.documentId) pending.set(id, item);
    }
  } catch {
    /* ignore corrupt file */
  }
}

function persistPending() {
  try {
    fs.mkdirSync(path.dirname(PENDING_PATH), { recursive: true });
    fs.writeFileSync(
      PENDING_PATH,
      JSON.stringify(Object.fromEntries(pending.entries()), null, 2)
    );
  } catch (err) {
    console.warn("[pending-proposals] persist failed:", err);
  }
}

export function savePendingProposal(item: PendingProposal) {
  ensureLoaded();
  pending.set(item.documentId, item);
  persistPending();
}

export function getPendingProposal(documentId: string): PendingProposal | null {
  ensureLoaded();
  return pending.get(documentId) ?? null;
}

export function takePendingProposal(documentId: string): PendingProposal | null {
  ensureLoaded();
  const item = pending.get(documentId) ?? null;
  if (item) {
    pending.delete(documentId);
    persistPending();
  }
  return item;
}

/** 관리자 화면에서 documentId 없이 등록할 때 최근 대기 제안서 연결 */
export function peekLatestPendingProposal(): PendingProposal | null {
  ensureLoaded();
  let latest: PendingProposal | null = null;
  for (const item of pending.values()) {
    if (!latest || item.createdAt > latest.createdAt) latest = item;
  }
  return latest;
}
