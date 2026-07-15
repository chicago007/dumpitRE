import type { ParsedCostCmReport } from "@/lib/analyzers/progress-report";
import type { ParsedProposal } from "@/lib/analyzers/proposal";
import {
  addDocument,
  answerQuestion,
  fundSchedules,
  getAttentionSites,
  getDashboardStats,
  getDocuments,
  getSiteDetail,
  progressReports,
  seed,
  sites,
} from "@/lib/data/seed";
import * as sbRepo from "@/lib/data/supabase-repository";
import { applyCostCmReport, applyProposal } from "@/lib/data/apply-analysis";
import { isSupabaseServerConfigured } from "@/lib/supabase/admin";
import { chunkText } from "@/lib/rag/chunk";
import { embedTexts, isEmbeddingConfigured } from "@/lib/rag/embed";
import { createChatSession, runChat } from "@/lib/rag/chat";
import type {
  DashboardStats,
  DocumentRecord,
  PortfolioProgressPoint,
  Site,
  SiteDetail,
} from "@/lib/types";

export function isSupabaseConfigured(): boolean {
  return isSupabaseServerConfigured();
}

export { createChatSession };

export async function listSites(filter?: { status?: string }): Promise<Site[]> {
  if (isSupabaseServerConfigured()) return sbRepo.sbListSites(filter);
  const { isSiteDeleted } = await import("@/lib/data/deleted-masters");
  let items = seed.sites.filter((s) => !isSiteDeleted(s.id));
  if (filter?.status && filter.status !== "all") {
    items = items.filter((s) => s.status === filter.status);
  }
  return items;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  if (isSupabaseServerConfigured()) return sbRepo.sbFetchDashboardStats();
  return getDashboardStats();
}

export async function fetchPortfolioProgress(): Promise<PortfolioProgressPoint[]> {
  if (isSupabaseServerConfigured()) return sbRepo.sbFetchPortfolioProgress();
  return seed.portfolioProgress;
}

export async function fetchAttentionSites(): Promise<Site[]> {
  if (isSupabaseServerConfigured()) return sbRepo.sbFetchAttentionSites();
  return getAttentionSites();
}

export async function fetchSiteDetail(id: string): Promise<SiteDetail | null> {
  if (isSupabaseServerConfigured()) return sbRepo.sbFetchSiteDetail(id);
  return getSiteDetail(id);
}

export async function fetchDocuments(): Promise<DocumentRecord[]> {
  if (isSupabaseServerConfigured()) {
    try {
      return await sbRepo.sbFetchDocuments();
    } catch (err) {
      console.warn("[documents] Supabase fetch failed, using local queue:", err);
      return getDocuments();
    }
  }
  return getDocuments();
}

/** Supabase documents.type CHECK에 없는 값은 other로 매핑 */
function toSupabaseDocType(type: DocumentRecord["type"]): string {
  if (type === "management_status") return "other";
  return type;
}

export async function createDocument(
  doc: DocumentRecord & { googleDriveFileId?: string | null }
): Promise<void> {
  if (isSupabaseServerConfigured()) {
    try {
      await sbRepo.sbCreateDocument({
        id: doc.id,
        siteId: doc.siteId,
        type: toSupabaseDocType(doc.type),
        fileName: doc.fileName,
        analysisStatus: doc.analysisStatus,
        googleDriveUrl: doc.googleDriveUrl,
        googleDriveFileId: doc.googleDriveFileId,
      });
    } catch (err) {
      console.warn("[documents] Supabase insert failed, keeping local only:", err);
    }
  }
  addDocument(doc);
}

export async function persistCostCmReport(
  legacySiteId: string | null,
  parsed: ParsedCostCmReport,
  documentId: string
) {
  const seedResult = applyCostCmReport(
    sites,
    progressReports,
    fundSchedules,
    legacySiteId,
    parsed,
    documentId
  );
  if (isSupabaseServerConfigured()) {
    await sbRepo.sbApplyCostCmReport(legacySiteId, parsed, documentId);
  }
  return seedResult;
}

export async function persistProposal(legacySiteId: string | null, parsed: ParsedProposal) {
  const seedResult = applyProposal(sites, legacySiteId, parsed);
  if (isSupabaseServerConfigured()) {
    await sbRepo.sbApplyProposal(legacySiteId, parsed);
  }
  return seedResult;
}

export async function indexDocumentText(
  documentId: string,
  siteLegacyId: string | null,
  text: string
): Promise<number> {
  if (!isSupabaseServerConfigured() || !isEmbeddingConfigured()) return 0;

  const chunks = chunkText(text);
  if (chunks.length === 0) return 0;

  const embeddings = await embedTexts(chunks);
  await sbRepo.sbInsertChunks(
    documentId,
    siteLegacyId,
    chunks.map((content, i) => ({ content, embedding: embeddings[i] }))
  );
  return chunks.length;
}

export async function queryChat(
  question: string,
  options?: { siteId?: string | null; sessionId?: string | null }
) {
  if (isSupabaseServerConfigured()) {
    return runChat(question, options);
  }
  return { ...answerQuestion(question), mode: "fallback" as const };
}
