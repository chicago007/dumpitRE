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
  /** 매입기관 (SH/GH/LH 등) */
  purchaseAgency: string | null;
  setupDate: string | null;
  /** 중도상환(예정)일 — 상환일과 별개 */
  earlyRepaymentDate: string | null;
  maturityDate: string | null;
  loanMaturityDate: string | null;
  /** 상환일 (완료·확정 상환) */
  repaymentDate: string | null;
  setupAmount: number | null;
  balance: number | null;
  interestRate: string | null;
  feeRate: string | null;
  /** 신탁방식 (예: 관리형 토지신탁) */
  trustType: string | null;
  /** 신탁사 */
  trustCompany: string | null;
  siteAddress: string | null;
  businessDesc: string | null;
  /** 시행사 */
  developer: string | null;
  /** 시공사 */
  contractor: string | null;
  /** 대지면적 (평/㎡ 표기) */
  landArea: string | null;
  /** 건축면적 */
  buildingArea: string | null;
  /** 연면적 */
  totalFloorArea: string | null;
  /** 건축규모 */
  buildingScale: string | null;
  /** 세대수 */
  householdCount: string | null;
  plannedProgressPct: number | null;
  actualProgressPct: number | null;
  vsPlan: string | null;
  note: string | null;
  /** 관리자 입력 진행현황 코멘트 */
  progressComment: string | null;
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

/** 기성/공정확인서 기준 랩 회차별 공정율 스냅샷 */
export interface LabProgressRow {
  id: string;
  labFundId: string | null;
  labName: string;
  fundName: string | null;
  siteAddress: string | null;
  plannedProgressPct: number | null;
  actualProgressPct: number | null;
  achievementPct: number | null;
  delayDays: number | null;
  confirmedDate: string | null;
  specialNotes: string | null;
  sourceFileName: string | null;
  documentId: string | null;
  updatedAt: string;
}

export type LabProgressApplyAction = "created" | "updated" | "stale" | "unmatched";

export interface LabProgressMatchCandidate {
  labName: string;
  fundName: string | null;
  siteAddress: string | null;
  score: number;
}

export interface LabProgressApplyResult {
  action: LabProgressApplyAction;
  message: string;
  row: LabProgressRow | null;
  existing: LabProgressRow | null;
  /** 동일주소·유사후보 — 수동 선택 시 우선 표시 */
  matchCandidates?: LabProgressMatchCandidate[];
  /** 동일 사업장·다른 사업자 등으로 확인 필요 */
  needsConfirmation?: boolean;
  /** 펀드명·사업자로 추정한 추천 랩 (확인 UI 프리셀렉트) */
  suggestedLabName?: string | null;
}

/** 관리자: 랩명/펀드명/사업장 주소 마스터 */
export interface ProductMaster {
  id: string;
  labName: string;
  fundName: string | null;
  siteAddress: string;
  siteName: string | null;
  aliases: string[];
  siteId: string | null;
  contractAmount: number | null;
  notes: string | null;
  hasProposal?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReviewQueueKind =
  | "progress_match"
  | "progress_stale"
  | "progress_extract_failed"
  | "proposal_register";

export type ReviewQueueStatus = "pending" | "resolved" | "dismissed";

/** 업로드 후 수동 처리가 필요한 항목 */
export interface ReviewQueueItem {
  id: string;
  kind: ReviewQueueKind;
  status: ReviewQueueStatus;
  documentId: string | null;
  fileName: string;
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
  resolvedAt: string | null;
}

/** 이번 달 공정 보고서가 없는 active 랩 */
export interface MissingProgressLab {
  labFundId: string;
  labName: string;
  fundName: string | null;
  siteAddress: string | null;
  lastConfirmedDate: string | null;
}

/** 제안서 업로드 후 신규/기존 선택용 랩 옵션 */
export interface ProposalLabOption {
  id: string;
  name: string;
  fundName: string | null;
  siteAddress: string | null;
}

/** 제안서에서 추출한 투자 주요 조건 (비교표·등록 UI용) */
export interface ProposalExtractedConditions {
  siteName: string | null;
  fundName: string | null;
  labName: string | null;
  totalBudget: number | null;
  constructionPeriod: string | null;
  location: string | null;
  setupDate: string | null;
  maturityDate: string | null;
  loanMaturityDate: string | null;
  interestRate: number | null;
  feeRate: number | null;
  purchaseAgency: string | null;
  developer: string | null;
  contractor: string | null;
  trustCompany: string | null;
  trustType: string | null;
  businessDesc: string | null;
  landArea: string | null;
  buildingArea: string | null;
  totalFloorArea: string | null;
  buildingScale: string | null;
  householdCount: string | null;
  highlights: string[];
}

/** 제안서 업로드 후 신규/기존 확인 UI로 넘기는 페이로드 */
export interface ProposalRegistrationPrompt {
  documentId: string;
  fileName: string;
  suggestedSiteName: string | null;
  suggestedFundName: string | null;
  suggestedLabName: string | null;
  suggestedLocation: string | null;
  suggestedBudget: number | null;
  matchedProductId: string | null;
  matchedLabFundId: string | null;
  matchedLabel: string | null;
  labOptions: ProposalLabOption[];
  question: string;
  /** 추출된 투자 주요 조건 (복수 업로드 시 비교표에 사용) */
  parsed: ProposalExtractedConditions;
  extractionSource?: "gemini" | "regex";
  extractionWarning?: string | null;
}
