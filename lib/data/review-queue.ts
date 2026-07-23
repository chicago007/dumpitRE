import fs from "fs";
import path from "path";
import {
  isReviewQueueDbConfigured,
  sbListReviewQueue,
  sbResolveReviewByDocumentId,
  sbUpdateReviewQueueStatus,
  sbUpsertReviewQueue,
} from "@/lib/data/supabase-review-queue";
import type {
  LabProgressApplyResult,
  ReviewQueueItem,
  ReviewQueueKind,
  ReviewQueueStatus,
} from "@/lib/types";

const PERSIST_PATH = path.join(process.cwd(), ".data", "review-queue.json");

let localCache: ReviewQueueItem[] | null = null;

function loadLocal(): ReviewQueueItem[] {
  if (localCache) return localCache;
  try {
    if (fs.existsSync(PERSIST_PATH)) {
      localCache = JSON.parse(fs.readFileSync(PERSIST_PATH, "utf8")) as ReviewQueueItem[];
      return localCache;
    }
  } catch (err) {
    console.warn("[review-queue] local load failed:", err);
  }
  localCache = [];
  return localCache;
}

function saveLocal(rows: ReviewQueueItem[]) {
  localCache = rows;
  try {
    fs.mkdirSync(path.dirname(PERSIST_PATH), { recursive: true });
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(rows, null, 2));
  } catch (err) {
    console.warn("[review-queue] local persist failed:", err);
  }
}

async function persistItem(item: ReviewQueueItem): Promise<ReviewQueueItem> {
  if (isReviewQueueDbConfigured()) {
    try {
      const saved = await sbUpsertReviewQueue(item);
      const local = loadLocal().filter((r) => r.id !== saved.id);
      local.push(saved);
      saveLocal(local);
      return saved;
    } catch (err) {
      console.warn("[review-queue] supabase upsert failed, local only:", err);
    }
  }
  const local = loadLocal().filter((r) => r.id !== item.id);
  local.push(item);
  saveLocal(local);
  return item;
}

export async function listReviewQueue(
  status: ReviewQueueStatus = "pending"
): Promise<ReviewQueueItem[]> {
  if (isReviewQueueDbConfigured()) {
    try {
      const rows = await sbListReviewQueue(status);
      if (status === "pending") {
        const local = loadLocal().filter((r) => r.status !== "pending");
        saveLocal([...local, ...rows]);
      }
      return rows;
    } catch (err) {
      console.warn("[review-queue] supabase list failed, local fallback:", err);
    }
  }
  return loadLocal()
    .filter((r) => r.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function enqueueReviewItem(input: {
  kind: ReviewQueueKind;
  documentId: string | null;
  fileName: string;
  message: string;
  payload?: Record<string, unknown>;
}): Promise<ReviewQueueItem> {
  const id = input.documentId
    ? `review-${input.documentId}`
    : `review-${crypto.randomUUID()}`;
  const item: ReviewQueueItem = {
    id,
    kind: input.kind,
    status: "pending",
    documentId: input.documentId,
    fileName: input.fileName,
    message: input.message,
    payload: input.payload ?? {},
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  return persistItem(item);
}

export async function resolveReviewByDocumentId(documentId: string): Promise<void> {
  if (isReviewQueueDbConfigured()) {
    try {
      await sbResolveReviewByDocumentId(documentId);
    } catch (err) {
      console.warn("[review-queue] supabase resolve failed:", err);
    }
  }
  const now = new Date().toISOString();
  saveLocal(
    loadLocal().map((r) =>
      r.documentId === documentId && r.status === "pending"
        ? { ...r, status: "resolved" as const, resolvedAt: now }
        : r
    )
  );
}

export async function updateReviewQueueStatus(
  id: string,
  status: ReviewQueueStatus
): Promise<ReviewQueueItem | null> {
  if (isReviewQueueDbConfigured()) {
    try {
      const updated = await sbUpdateReviewQueueStatus(id, status);
      if (updated) {
        saveLocal(loadLocal().map((r) => (r.id === id ? updated : r)));
        return updated;
      }
    } catch (err) {
      console.warn("[review-queue] supabase status update failed:", err);
    }
  }
  const prev = loadLocal().find((r) => r.id === id);
  if (!prev) return null;
  const next: ReviewQueueItem = {
    ...prev,
    status,
    resolvedAt: status === "pending" ? null : new Date().toISOString(),
  };
  saveLocal(loadLocal().map((r) => (r.id === id ? next : r)));
  return next;
}

export async function enqueueProgressReview(
  fileName: string,
  documentId: string,
  labProgress: LabProgressApplyResult,
  extra?: { extractionFailed?: boolean }
): Promise<void> {
  // 추출 실패는 created/updated여도 대기함에 남겨 수동 확인
  if (extra?.extractionFailed) {
    await enqueueReviewItem({
      kind: "progress_extract_failed",
      documentId,
      fileName,
      message:
        labProgress.message ||
        "공정율을 추출하지 못했습니다. 업로드 화면에서 랩을 확인하고 수정하세요.",
      payload: {
        row: labProgress.row,
        existing: labProgress.existing,
        matchCandidates: labProgress.matchCandidates,
        needsConfirmation: true,
        suggestedLabName: labProgress.suggestedLabName,
        action: labProgress.action,
        extractionFailed: true,
      },
    });
    return;
  }

  if (labProgress.action === "created" || labProgress.action === "updated") {
    await resolveReviewByDocumentId(documentId);
    return;
  }

  let kind: ReviewQueueKind = "progress_match";
  if (labProgress.action === "stale") kind = "progress_stale";

  await enqueueReviewItem({
    kind,
    documentId,
    fileName,
    message: labProgress.message,
    payload: {
      row: labProgress.row,
      existing: labProgress.existing,
      matchCandidates: labProgress.matchCandidates,
      needsConfirmation: labProgress.needsConfirmation,
      suggestedLabName: labProgress.suggestedLabName,
      action: labProgress.action,
    },
  });
}

export async function enqueueProposalReview(
  fileName: string,
  documentId: string,
  message: string,
  payload?: Record<string, unknown>
): Promise<void> {
  await enqueueReviewItem({
    kind: "proposal_register",
    documentId,
    fileName,
    message,
    payload: payload ?? {},
  });
}
