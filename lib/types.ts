export type SiteStatus = "planned" | "in_progress" | "completed" | "suspended";

export type DocumentType =
  | "proposal"
  | "progress_report"
  | "fund_schedule"
  | "management_status"
  | "other";

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

/** 부동산랩 관리현황 (엑셀) 1건 */
export type LabFundStatus = "active" | "repaid" | "unknown";

export interface LabInterestPayment {
  round: number;
  date: string;
  raw?: string;
}

export interface LabFund {
  id: string;
  name: string;
  productCode: string | null;
  fundName: string | null;
  fundCode: string | null;
  purchaseAgency: string | null;
  setupDate: string | null;
  maturityDate: string | null;
  loanMaturityDate: string | null;
  repaymentDate: string | null;
  setupAmount: number | null;
  balance: number | null;
  interestRate: number | null;
  feeRate: number | null;
  trustType: string | null;
  siteAddress: string | null;
  businessDesc: string | null;
  plannedProgressPct: number | null;
  actualProgressPct: number | null;
  vsPlan: string | null;
  note: string | null;
  interestPayments: LabInterestPayment[];
  status: LabFundStatus;
}

export interface LabPortfolioSnapshot {
  uploadedAt: string;
  fileName: string;
  funds: LabFund[];
  stats: {
    totalCount: number;
    activeCount: number;
    repaidCount: number;
    totalSetupAmount: number;
    totalBalance: number;
  };
}
