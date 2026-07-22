import { createAdminClient, isSupabaseServerConfigured } from "@/lib/supabase/admin";
import type { LabProgressRow } from "@/lib/types";

type LabProgressDbRow = {
  id: string;
  lab_fund_id: string | null;
  lab_name: string;
  fund_name: string | null;
  site_address: string | null;
  planned_progress_pct: number | null;
  actual_progress_pct: number | null;
  achievement_pct: number | null;
  delay_days: number | null;
  confirmed_date: string | null;
  special_notes: string | null;
  source_file_name: string | null;
  document_id: string | null;
  updated_at: string;
};

function db() {
  const client = createAdminClient();
  if (!client) throw new Error("Supabase admin client not configured");
  return client;
}

export function rowToLabProgress(row: LabProgressDbRow): LabProgressRow {
  return {
    id: row.id,
    labFundId: row.lab_fund_id,
    labName: row.lab_name,
    fundName: row.fund_name,
    siteAddress: row.site_address,
    plannedProgressPct:
      row.planned_progress_pct != null ? Number(row.planned_progress_pct) : null,
    actualProgressPct:
      row.actual_progress_pct != null ? Number(row.actual_progress_pct) : null,
    achievementPct: row.achievement_pct != null ? Number(row.achievement_pct) : null,
    delayDays: row.delay_days != null ? Number(row.delay_days) : null,
    confirmedDate: row.confirmed_date,
    specialNotes: row.special_notes,
    sourceFileName: row.source_file_name,
    documentId: row.document_id,
    updatedAt: row.updated_at,
  };
}

export function labProgressToRow(row: LabProgressRow): LabProgressDbRow {
  return {
    id: row.id,
    lab_fund_id: row.labFundId,
    lab_name: row.labName,
    fund_name: row.fundName,
    site_address: row.siteAddress,
    planned_progress_pct: row.plannedProgressPct,
    actual_progress_pct: row.actualProgressPct,
    achievement_pct: row.achievementPct,
    delay_days: row.delayDays,
    confirmed_date: row.confirmedDate,
    special_notes: row.specialNotes,
    source_file_name: row.sourceFileName,
    document_id: row.documentId,
    updated_at: row.updatedAt,
  };
}

export function isLabProgressDbConfigured(): boolean {
  return isSupabaseServerConfigured();
}

/** 랩·확인일 기준 안정적 id (동일 보고서 재업로드 시 덮어쓰기) */
export function labProgressRowId(
  labFundId: string | null,
  labName: string,
  confirmedDate: string | null
): string {
  const key = (labFundId ?? labName.replace(/\s+/g, "")).slice(0, 100);
  if (confirmedDate) return `${key}--${confirmedDate}`;
  return `${key}--nodate--${crypto.randomUUID().slice(0, 8)}`;
}

/** 기성 자료 없는 active 랩용 안정적 placeholder id */
export function labProgressPlaceholderId(
  labFundId: string | null,
  labName: string
): string {
  const key = (labFundId ?? labName.replace(/\s+/g, "")).slice(0, 100);
  return `${key}--placeholder`;
}

function sortByLabThenDate(a: LabProgressRow, b: LabProgressRow): number {
  const lab = b.labName.localeCompare(a.labName, "ko", { numeric: true });
  if (lab !== 0) return lab;
  return compareDateStr(b.confirmedDate, a.confirmedDate);
}

function compareDateStr(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.localeCompare(b);
}

/** 확인일 기준 랩별 최신 1건 */
export function pickLatestPerLab(rows: LabProgressRow[]): LabProgressRow[] {
  const byLab = new Map<string, LabProgressRow>();
  for (const row of [...rows].sort(sortByLabThenDate)) {
    const key = row.labName.replace(/\s+/g, "").toLowerCase();
    if (!byLab.has(key)) byLab.set(key, row);
  }
  return [...byLab.values()].sort((a, b) =>
    b.labName.localeCompare(a.labName, "ko", { numeric: true })
  );
}

export async function sbListAllLabProgress(): Promise<LabProgressRow[]> {
  const { data, error } = await db()
    .from("lab_progress")
    .select("*")
    .order("confirmed_date", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return ((data ?? []) as LabProgressDbRow[]).map(rowToLabProgress);
}

export async function sbListLabProgress(): Promise<LabProgressRow[]> {
  const all = await sbListAllLabProgress();
  return pickLatestPerLab(all);
}

export async function sbGetLatestLabProgressByLabName(
  labName: string
): Promise<LabProgressRow | null> {
  const { data, error } = await db()
    .from("lab_progress")
    .select("*")
    .eq("lab_name", labName)
    .order("confirmed_date", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToLabProgress(data as LabProgressDbRow) : null;
}

export async function sbGetLabProgressByLabName(
  labName: string
): Promise<LabProgressRow | null> {
  return sbGetLatestLabProgressByLabName(labName);
}

export async function sbGetLabProgressByLabAndDate(
  labName: string,
  confirmedDate: string | null
): Promise<LabProgressRow | null> {
  if (!confirmedDate) return null;
  const { data, error } = await db()
    .from("lab_progress")
    .select("*")
    .eq("lab_name", labName)
    .eq("confirmed_date", confirmedDate)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToLabProgress(data as LabProgressDbRow) : null;
}

export async function sbUpsertLabProgress(row: LabProgressRow): Promise<LabProgressRow> {
  const payload = labProgressToRow({
    ...row,
    updatedAt: new Date().toISOString(),
  });
  const { data, error } = await db()
    .from("lab_progress")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return rowToLabProgress(data as LabProgressDbRow);
}
