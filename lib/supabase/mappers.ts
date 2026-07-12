import type {
  AnalysisStatus,
  DocumentRecord,
  DocumentType,
  FundSchedule,
  ProgressReport,
  Site,
  SiteDetail,
  SiteStatus,
} from "@/lib/types";
import { uuidToLegacyId } from "@/lib/supabase/site-map";

type SiteRow = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  status: SiteStatus;
  start_date: string | null;
  end_date: string | null;
  contract_amount: number | null;
  contractor: string | null;
  cm_company: string | null;
  latest_progress_pct: number | null;
  planned_progress_pct: number | null;
  latest_fund_pct: number | null;
  latest_report_month: string | null;
};

export function mapSiteRow(row: SiteRow): Site {
  return {
    id: uuidToLegacyId(row.id),
    name: row.name,
    code: row.code,
    address: row.address ?? "",
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    contractAmount: row.contract_amount,
    contractor: row.contractor,
    cmCompany: row.cm_company,
    latestProgressPct: row.latest_progress_pct,
    plannedProgressPct: row.planned_progress_pct,
    latestFundPct: row.latest_fund_pct,
    latestReportMonth: row.latest_report_month,
  };
}

export function mapProgressRow(row: {
  id: string;
  site_id: string;
  report_month: string;
  overall_progress_pct: number;
  planned_progress_pct: number;
  details: unknown;
  notes: string | null;
}): ProgressReport {
  return {
    id: row.id,
    siteId: uuidToLegacyId(row.site_id),
    reportMonth: row.report_month,
    overallProgressPct: Number(row.overall_progress_pct),
    plannedProgressPct: Number(row.planned_progress_pct),
    details: (row.details as ProgressReport["details"]) ?? [],
    notes: row.notes,
  };
}

export function mapFundRow(row: {
  id: string;
  site_id: string;
  schedule_month: string;
  planned_amount: number;
  actual_amount: number | null;
}): FundSchedule {
  return {
    id: row.id,
    siteId: uuidToLegacyId(row.site_id),
    scheduleMonth: row.schedule_month,
    plannedAmount: Number(row.planned_amount),
    actualAmount: row.actual_amount != null ? Number(row.actual_amount) : null,
  };
}

export function mapDocumentRow(row: {
  id: string;
  site_id: string | null;
  type: DocumentType;
  file_name: string;
  analysis_status: AnalysisStatus;
  uploaded_at: string;
  google_drive_url: string | null;
}, siteName?: string | null): DocumentRecord {
  return {
    id: row.id,
    siteId: row.site_id ? uuidToLegacyId(row.site_id) : null,
    siteName: siteName ?? null,
    type: row.type,
    fileName: row.file_name,
    analysisStatus: row.analysis_status,
    uploadedAt: row.uploaded_at,
    googleDriveUrl: row.google_drive_url,
  };
}

export function mapSiteDetail(
  site: Site,
  progress: ProgressReport[],
  funds: FundSchedule[],
  docs: DocumentRecord[]
): SiteDetail {
  return { ...site, progressReports: progress, fundSchedules: funds, documents: docs };
}
