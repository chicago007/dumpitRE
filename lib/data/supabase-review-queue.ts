import { createAdminClient, isSupabaseServerConfigured } from "@/lib/supabase/admin";
import type { ReviewQueueItem, ReviewQueueKind, ReviewQueueStatus } from "@/lib/types";

type ReviewQueueDbRow = {
  id: string;
  kind: ReviewQueueKind;
  status: ReviewQueueStatus;
  document_id: string | null;
  file_name: string;
  message: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
};

function db() {
  const client = createAdminClient();
  if (!client) throw new Error("Supabase admin client not configured");
  return client;
}

export function isReviewQueueDbConfigured(): boolean {
  return isSupabaseServerConfigured();
}

function rowToItem(row: ReviewQueueDbRow): ReviewQueueItem {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    documentId: row.document_id,
    fileName: row.file_name,
    message: row.message,
    payload: row.payload ?? {},
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function toDbRow(item: ReviewQueueItem): ReviewQueueDbRow {
  return {
    id: item.id,
    kind: item.kind,
    status: item.status,
    document_id: item.documentId,
    file_name: item.fileName,
    message: item.message,
    payload: item.payload,
    created_at: item.createdAt,
    resolved_at: item.resolvedAt,
  };
}

export async function sbListReviewQueue(
  status: ReviewQueueStatus = "pending"
): Promise<ReviewQueueItem[]> {
  const { data, error } = await db()
    .from("review_queue")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ReviewQueueDbRow[]).map(rowToItem);
}

export async function sbUpsertReviewQueue(item: ReviewQueueItem): Promise<ReviewQueueItem> {
  const { data, error } = await db()
    .from("review_queue")
    .upsert(toDbRow(item), { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return rowToItem(data as ReviewQueueDbRow);
}

export async function sbResolveReviewByDocumentId(documentId: string): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("review_queue")
    .update({ status: "resolved", resolved_at: now })
    .eq("document_id", documentId)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function sbUpdateReviewQueueStatus(
  id: string,
  status: ReviewQueueStatus
): Promise<ReviewQueueItem | null> {
  const { data, error } = await db()
    .from("review_queue")
    .update({
      status,
      resolved_at: status === "pending" ? null : new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? rowToItem(data as ReviewQueueDbRow) : null;
}
