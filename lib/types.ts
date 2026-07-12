export type SiteStatus = "planned" | "in_progress" | "completed" | "suspended";

export type DocumentType = "proposal" | "progress_report" | "fund_schedule" | "other";

export type AnalysisStatus = "pending" | "processing" | "done" | "failed" | "needs_review";

export interface Site {
  id: string;
  name: string;
  code: string;
  address: string;
  status: SiteStatus;
  startDate: string | null;
  endDate: string | null;
  contractAmount: number | null;
  contractor: string | null;
  cmCompany: string | null;
  latestProgressPct: number | null;
  plannedProgressPct: number | null;
  latestFundPct: number | null;
  latestReportMonth: string | null;
}

export interface ProgressReport {
  id: string;
  siteId: string;
  reportMonth: string;
  overallProgressPct: number;
  plannedProgressPct: number;
  details: { trade: string; actual: number; planned: number }[];
  notes: string | null;
}

export interface FundSchedule {
  id: string;
  siteId: string;
  scheduleMonth: string;
  plannedAmount: number;
  actualAmount: number | null;
}

export interface DocumentRecord {
  id: string;
  siteId: string | null;
  siteName: string | null;
  type: DocumentType;
  fileName: string;
  analysisStatus: AnalysisStatus;
  uploadedAt: string;
  googleDriveUrl: string | null;
}

export interface DashboardStats {
  inProgressCount: number;
  avgProgressPct: number;
  delayedCount: number;
  monthlyFundPct: number;
}

export interface PortfolioProgressPoint {
  month: string;
  planned: number;
  actual: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
}

export interface SiteDetail extends Site {
  progressReports: ProgressReport[];
  fundSchedules: FundSchedule[];
  documents: DocumentRecord[];
}
