import type { ParsedCostCmReport } from "@/lib/analyzers/progress-report";
import type { ParsedProposal } from "@/lib/analyzers/proposal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mapDocumentRow,
  mapFundRow,
  mapProgressRow,
  mapSiteDetail,
  mapSiteRow,
} from "@/lib/supabase/mappers";
import { CODE_TO_UUID, legacyIdToUuid } from "@/lib/supabase/site-map";
import type {
  DashboardStats,
  DocumentRecord,
  PortfolioProgressPoint,
  Site,
  SiteDetail,
} from "@/lib/types";

function db() {
  const client = createAdminClient();
  if (!client) throw new Error("Supabase not configured");
  return client;
}

export async function sbListSites(filter?: { status?: string }): Promise<Site[]> {
  let query = db().from("sites").select("*").order("name");
  if (filter?.status && filter.status !== "all") {
    query = query.eq("status", filter.status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapSiteRow);
}

export async function sbFetchSiteDetail(legacyId: string): Promise<SiteDetail | null> {
  const uuid = legacyIdToUuid(legacyId) ?? legacyId;
  const { data: siteRow, error } = await db().from("sites").select("*").eq("id", uuid).maybeSingle();
  if (error) throw error;
  if (!siteRow) return null;

  const site = mapSiteRow(siteRow);

  const [pr, fs, docs] = await Promise.all([
    db().from("progress_reports").select("*").eq("site_id", uuid).order("report_month", { ascending: false }),
    db().from("fund_schedules").select("*").eq("site_id", uuid).order("schedule_month", { ascending: false }),
    db().from("documents").select("*").eq("site_id", uuid).order("uploaded_at", { ascending: false }),
  ]);

  return mapSiteDetail(
    site,
    (pr.data ?? []).map(mapProgressRow),
    (fs.data ?? []).map(mapFundRow),
    (docs.data ?? []).map((d) => mapDocumentRow(d, site.name))
  );
}

export async function sbFetchDashboardStats(): Promise<DashboardStats> {
  const sites = await sbListSites({ status: "in_progress" });
  const withProgress = sites.filter((s) => s.latestProgressPct != null);
  const avgProgress =
    withProgress.length > 0
      ? withProgress.reduce((s, x) => s + (x.latestProgressPct ?? 0), 0) / withProgress.length
      : 0;
  const delayed = sites.filter(
    (s) =>
      s.latestProgressPct != null &&
      s.plannedProgressPct != null &&
      s.latestProgressPct < s.plannedProgressPct - 5
  ).length;
  const withFund = sites.filter((s) => s.latestFundPct != null);
  const avgFund =
    withFund.length > 0
      ? withFund.reduce((s, x) => s + (x.latestFundPct ?? 0), 0) / withFund.length
      : 0;

  return {
    inProgressCount: sites.length,
    avgProgressPct: Math.round(avgProgress * 10) / 10,
    delayedCount: delayed,
    monthlyFundPct: Math.round(avgFund * 10) / 10,
  };
}

export async function sbFetchPortfolioProgress(): Promise<PortfolioProgressPoint[]> {
  const { data } = await db()
    .from("progress_reports")
    .select("report_month, overall_progress_pct, planned_progress_pct")
    .order("report_month");

  const byMonth = new Map<string, { actual: number[]; planned: number[] }>();
  for (const row of data ?? []) {
    const month = row.report_month.slice(0, 7);
    const entry = byMonth.get(month) ?? { actual: [], planned: [] };
    entry.actual.push(Number(row.overall_progress_pct));
    entry.planned.push(Number(row.planned_progress_pct));
    byMonth.set(month, entry);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      actual: v.actual.reduce((a, b) => a + b, 0) / v.actual.length,
      planned: v.planned.reduce((a, b) => a + b, 0) / v.planned.length,
    }));
}

export async function sbFetchAttentionSites(): Promise<Site[]> {
  const sites = await sbListSites({ status: "in_progress" });
  return sites
    .filter(
      (s) =>
        s.latestProgressPct != null &&
        s.plannedProgressPct != null &&
        s.latestProgressPct < s.plannedProgressPct - 3
    )
    .slice(0, 5);
}

export async function sbFetchDocuments(): Promise<DocumentRecord[]> {
  const { data, error } = await db()
    .from("documents")
    .select("*, sites(name)")
    .order("uploaded_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((d) => {
    const siteName = (d.sites as { name?: string } | null)?.name ?? null;
    const { sites: _, ...doc } = d;
    return mapDocumentRow(doc, siteName);
  });
}

export async function sbCreateDocument(doc: {
  id: string;
  siteId: string | null;
  type: string;
  fileName: string;
  analysisStatus: string;
  googleDriveUrl: string | null;
  googleDriveFileId?: string | null;
}): Promise<void> {
  const siteUuid = doc.siteId ? legacyIdToUuid(doc.siteId) ?? doc.siteId : null;
  const { error } = await db().from("documents").insert({
    id: doc.id,
    site_id: siteUuid,
    type: doc.type,
    file_name: doc.fileName,
    analysis_status: doc.analysisStatus,
    google_drive_url: doc.googleDriveUrl,
    google_drive_file_id: doc.googleDriveFileId ?? null,
    analyzed_at: doc.analysisStatus === "done" ? new Date().toISOString() : null,
  });
  if (error) throw error;
}

export async function sbApplyCostCmReport(
  legacySiteId: string | null,
  parsed: ParsedCostCmReport,
  documentId: string
): Promise<string | null> {
  if (!legacySiteId) return null;
  const siteUuid = legacyIdToUuid(legacySiteId) ?? legacySiteId;

  if (parsed.overallProgressPct != null && parsed.reportMonth) {
    await db().from("progress_reports").upsert(
      {
        site_id: siteUuid,
        document_id: documentId,
        report_month: parsed.reportMonth,
        overall_progress_pct: parsed.overallProgressPct,
        planned_progress_pct: parsed.plannedProgressPct ?? parsed.overallProgressPct,
        details: parsed.trades,
        notes: parsed.reportRound ? `제${parsed.reportRound}회 CM기성실사` : null,
      },
      { onConflict: "site_id,report_month" }
    );

    await db()
      .from("sites")
      .update({
        latest_progress_pct: parsed.overallProgressPct,
        planned_progress_pct: parsed.plannedProgressPct,
        latest_report_month: parsed.reportMonth,
        contractor: parsed.contractor ?? undefined,
        contract_amount: parsed.contractAmount ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", siteUuid);
  }

  if (parsed.cumulativeFundPct != null && parsed.reportMonth) {
    await db().from("fund_schedules").upsert(
      {
        site_id: siteUuid,
        document_id: documentId,
        schedule_month: parsed.reportMonth,
        planned_amount: parsed.monthlyFundAmount ?? 0,
        actual_amount: parsed.monthlyFundAmount,
        source: "document",
      },
      { onConflict: "site_id,schedule_month" }
    );

    await db()
      .from("sites")
      .update({ latest_fund_pct: parsed.cumulativeFundPct, updated_at: new Date().toISOString() })
      .eq("id", siteUuid);
  }

  return siteUuid;
}

export async function sbApplyProposal(
  legacySiteId: string | null,
  parsed: ParsedProposal
): Promise<string | null> {
  if (!legacySiteId) return null;
  const siteUuid = legacyIdToUuid(legacySiteId) ?? legacySiteId;

  await db()
    .from("sites")
    .update({
      name: parsed.siteName ?? undefined,
      contract_amount: parsed.totalBudget ?? undefined,
      address: parsed.location ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", siteUuid);

  return siteUuid;
}

export async function sbGetSiteUuidByLegacy(legacyId: string): Promise<string | null> {
  return legacyIdToUuid(legacyId) ?? null;
}

export async function sbGetSiteUuidByCode(code: string): Promise<string | null> {
  return CODE_TO_UUID[code] ?? null;
}

export async function sbQuerySitesStructured(question: string): Promise<{ sql: string; rows: unknown[] } | null> {
  const q = question.toLowerCase();

  if (q.includes("지연") || q.includes("미달")) {
    const sites = await sbListSites({ status: "in_progress" });
    const delayed = sites.filter(
      (s) =>
        s.latestProgressPct != null &&
        s.plannedProgressPct != null &&
        s.latestProgressPct < s.plannedProgressPct - 5
    );
    return { sql: "sites WHERE progress < planned - 5", rows: delayed };
  }

  if (q.includes("진행") && (q.includes("몇") || q.includes("수"))) {
    const sites = await sbListSites({ status: "in_progress" });
    return { sql: "sites WHERE status=in_progress", rows: sites };
  }

  return null;
}

export async function sbMatchChunks(embedding: number[], siteLegacyId?: string | null) {
  const siteUuid = siteLegacyId ? legacyIdToUuid(siteLegacyId) : null;
  const { data, error } = await db().rpc("match_document_chunks", {
    query_embedding: embedding,
    match_threshold: 0.45,
    match_count: 6,
    filter_site_id: siteUuid,
  });
  if (error) throw error;
  return data as { content: string; similarity: number; document_id: string }[];
}

export async function sbInsertChunks(
  documentId: string,
  siteLegacyId: string | null,
  chunks: { content: string; embedding: number[] }[]
): Promise<void> {
  const siteUuid = siteLegacyId ? legacyIdToUuid(siteLegacyId) : null;
  const rows = chunks.map((c, i) => ({
    document_id: documentId,
    site_id: siteUuid,
    chunk_index: i,
    content: c.content,
    embedding: c.embedding,
  }));
  const { error } = await db().from("document_chunks").insert(rows);
  if (error) throw error;
}

export async function sbSaveChatMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  citations?: string[]
): Promise<void> {
  await db().from("chat_messages").insert({
    session_id: sessionId,
    role,
    content,
    citations: citations ?? [],
  });
}

export async function sbGetOrCreateSession(siteLegacyId?: string | null): Promise<string> {
  const siteUuid = siteLegacyId ? legacyIdToUuid(siteLegacyId) : null;
  const { data, error } = await db()
    .from("chat_sessions")
    .insert({ site_id: siteUuid, title: "새 대화" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
