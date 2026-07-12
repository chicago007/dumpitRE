import type {
  DashboardStats,
  DocumentRecord,
  FundSchedule,
  PortfolioProgressPoint,
  ProgressReport,
  Site,
  SiteDetail,
} from "@/lib/types";

const sites: Site[] = [
  {
    id: "site-hwawon",
    name: "의정부 호원동 LH매입 공동주택",
    code: "HW-001",
    address: "경기 의정부시 호원동 57-3 외 4필지",
    status: "in_progress",
    startDate: "2025-06-01",
    endDate: "2027-12-31",
    contractAmount: 20_537_400_000,
    contractor: "계림종합건설",
    cmCompany: "코스트CM",
    latestProgressPct: 28.57,
    plannedProgressPct: 47.64,
    latestFundPct: 27.08,
    latestReportMonth: "2026-05-01",
  },
  {
    id: "site-jayang",
    name: "광진 자양동 491-5 도시형생활주택",
    code: "JY-002",
    address: "서울 광진구 자양동 491-5",
    status: "in_progress",
    startDate: "2025-11-20",
    endDate: "2026-11-21",
    contractAmount: 2_950_000_000,
    contractor: "에스하임월드",
    cmCompany: "코스트CM",
    latestProgressPct: 52.76,
    plannedProgressPct: 43.7,
    latestFundPct: null,
    latestReportMonth: "2026-06-01",
  },
  {
    id: "site-changdong",
    name: "창동 609-45 SH매입확약",
    code: "CD-003",
    address: "서울 도봉구 창동 609-44",
    status: "in_progress",
    startDate: "2025-12-31",
    endDate: "2027-06-30",
    contractAmount: 42_000_000_000,
    contractor: "명성인토피아",
    cmCompany: "코스트CM",
    latestProgressPct: 58,
    plannedProgressPct: 65,
    latestFundPct: 52,
    latestReportMonth: "2026-05-01",
  },
  {
    id: "site-gildong",
    name: "길동 IM_SH (강동구 228-1)",
    code: "GD-004",
    address: "서울 강동구 길동 228-1",
    status: "planned",
    startDate: "2026-06-04",
    endDate: "2028-03-21",
    contractAmount: 16_000_000_000,
    contractor: "대정종합건설",
    cmCompany: "코스트CM",
    latestProgressPct: null,
    plannedProgressPct: null,
    latestFundPct: null,
    latestReportMonth: null,
  },
  {
    id: "site-pangyo",
    name: "판교 ○○ 오피스",
    code: "PG-005",
    address: "경기 성남시 분당구",
    status: "in_progress",
    startDate: "2025-03-01",
    endDate: "2026-12-31",
    contractAmount: 55_000_000_000,
    contractor: "○○건설",
    cmCompany: "코스트CM",
    latestProgressPct: 89,
    plannedProgressPct: 85,
    latestFundPct: 85,
    latestReportMonth: "2026-07-01",
  },
  {
    id: "site-ilsan",
    name: "일산 ○△ 신축",
    code: "IS-006",
    address: "경기 고양시 일산동구",
    status: "in_progress",
    startDate: "2025-01-15",
    endDate: "2026-10-31",
    contractAmount: 28_000_000_000,
    contractor: "△△건설",
    cmCompany: "코스트CM",
    latestProgressPct: 44,
    plannedProgressPct: 58,
    latestFundPct: 38,
    latestReportMonth: "2026-07-01",
  },
];

const progressReports: ProgressReport[] = [
  {
    id: "pr-hw-9",
    siteId: "site-hwawon",
    reportMonth: "2026-05-01",
    overallProgressPct: 28.57,
    plannedProgressPct: 47.64,
    details: [
      { trade: "토목", actual: 8.56, planned: 8.56 },
      { trade: "건축", actual: 14.15, planned: 24.94 },
      { trade: "기계", actual: 0.77, planned: 1.64 },
      { trade: "전기", actual: 0.63, planned: 1.37 },
      { trade: "간접비", actual: 3.84, planned: 7.21 },
    ],
    notes: "제9회 CM기성실사",
  },
  {
    id: "pr-jy-4",
    siteId: "site-jayang",
    reportMonth: "2026-06-01",
    overallProgressPct: 52.76,
    plannedProgressPct: 43.7,
    details: [
      { trade: "건축", actual: 32.13, planned: 37.39 },
      { trade: "토목", actual: 6.84, planned: 5.13 },
      { trade: "기계", actual: 2.73, planned: 2.69 },
      { trade: "전기", actual: 2.1, planned: 1.11 },
      { trade: "소방", actual: 2.34, planned: 2.04 },
    ],
    notes: "제4회 CM기성실사",
  },
  {
    id: "pr-cd-1",
    siteId: "site-changdong",
    reportMonth: "2026-05-01",
    overallProgressPct: 58,
    plannedProgressPct: 65,
    details: [
      { trade: "토공", actual: 90, planned: 95 },
      { trade: "골조", actual: 55, planned: 68 },
      { trade: "설비", actual: 30, planned: 45 },
      { trade: "마감", actual: 10, planned: 20 },
    ],
    notes: "제1회 CM기성실사",
  },
];

const fundSchedules: FundSchedule[] = [
  { id: "fs-hw-5", siteId: "site-hwawon", scheduleMonth: "2026-05-01", plannedAmount: 666_600_000, actualAmount: 666_600_000 },
  { id: "fs-jy-6", siteId: "site-jayang", scheduleMonth: "2026-06-01", plannedAmount: 980_000_000, actualAmount: 920_000_000 },
  { id: "fs-cd-5", siteId: "site-changdong", scheduleMonth: "2026-05-01", plannedAmount: 2_100_000_000, actualAmount: 1_850_000_000 },
];

const documents: DocumentRecord[] = [
  {
    id: "doc-1",
    siteId: "site-hwawon",
    siteName: "의정부 호원동 LH매입 공동주택",
    type: "progress_report",
    fileName: "00.기성실사보고서 - 의정부시 호원동 57-3 외 4필지.pdf",
    analysisStatus: "done",
    uploadedAt: "2026-05-28T09:00:00Z",
    googleDriveUrl: null,
  },
  {
    id: "doc-2",
    siteId: "site-jayang",
    siteName: "광진 자양동 491-5 도시형생활주택",
    type: "progress_report",
    fileName: "00.기성실사보고서 - 자양동 491-5(202605).pdf",
    analysisStatus: "done",
    uploadedAt: "2026-06-12T10:30:00Z",
    googleDriveUrl: null,
  },
  {
    id: "doc-3",
    siteId: "site-changdong",
    siteName: "창동 609-45 SH매입확약",
    type: "progress_report",
    fileName: "00.기성실사보고서 - 창동 609-45 SH매입확약.pdf",
    analysisStatus: "done",
    uploadedAt: "2026-05-21T14:00:00Z",
    googleDriveUrl: null,
  },
  {
    id: "doc-4",
    siteId: "site-gildong",
    siteName: "길동 IM_SH 투자제안",
    type: "proposal",
    fileName: "IM_SH_길동_v1.pdf",
    analysisStatus: "done",
    uploadedAt: "2026-07-01T11:00:00Z",
    googleDriveUrl: null,
  },
];

const portfolioProgress: PortfolioProgressPoint[] = [
  { month: "2026-01", planned: 12, actual: 10 },
  { month: "2026-02", planned: 24, actual: 22 },
  { month: "2026-03", planned: 36, actual: 34 },
  { month: "2026-04", planned: 48, actual: 42 },
  { month: "2026-05", planned: 58, actual: 55 },
  { month: "2026-06", planned: 68, actual: 61 },
  { month: "2026-07", planned: 76, actual: 72 },
];

export const seed = {
  sites,
  progressReports,
  fundSchedules,
  documents,
  portfolioProgress,
};

export function getDashboardStats(): DashboardStats {
  const inProgress = sites.filter((s) => s.status === "in_progress");
  const withProgress = inProgress.filter((s) => s.latestProgressPct != null);
  const avgProgress =
    withProgress.length > 0
      ? withProgress.reduce((sum, s) => sum + (s.latestProgressPct ?? 0), 0) / withProgress.length
      : 0;
  const delayed = inProgress.filter(
    (s) =>
      s.latestProgressPct != null &&
      s.plannedProgressPct != null &&
      s.latestProgressPct < s.plannedProgressPct - 5
  ).length;
  const withFund = inProgress.filter((s) => s.latestFundPct != null);
  const avgFund =
    withFund.length > 0
      ? withFund.reduce((sum, s) => sum + (s.latestFundPct ?? 0), 0) / withFund.length
      : 0;

  return {
    inProgressCount: inProgress.length,
    avgProgressPct: Math.round(avgProgress * 10) / 10,
    delayedCount: delayed,
    monthlyFundPct: Math.round(avgFund * 10) / 10,
  };
}

export function getSiteDetail(id: string): SiteDetail | null {
  const site = sites.find((s) => s.id === id);
  if (!site) return null;
  return {
    ...site,
    progressReports: progressReports.filter((p) => p.siteId === id),
    fundSchedules: fundSchedules.filter((f) => f.siteId === id),
    documents: documents.filter((d) => d.siteId === id),
  };
}

export function getAttentionSites(): Site[] {
  return sites
    .filter((s) => s.status === "in_progress")
    .filter(
      (s) =>
        s.latestProgressPct != null &&
        s.plannedProgressPct != null &&
        s.latestProgressPct < s.plannedProgressPct - 3
    )
    .slice(0, 5);
}

export function answerQuestion(question: string): { content: string; citations: string[] } {
  const q = question.toLowerCase();

  if (q.includes("지연") || q.includes("미달")) {
    const delayed = sites.filter(
      (s) =>
        s.status === "in_progress" &&
        s.latestProgressPct != null &&
        s.plannedProgressPct != null &&
        s.latestProgressPct < s.plannedProgressPct - 5
    );
    if (delayed.length === 0) {
      return { content: "현재 계획 대비 5%p 이상 지연된 사업장은 없습니다.", citations: ["sites"] };
    }
    const list = delayed.map((s) => `${s.name} (실적 ${s.latestProgressPct}%, 계획 ${s.plannedProgressPct}%)`).join("\n");
    return {
      content: `공정율이 계획 대비 5%p 이상 낮은 사업장 ${delayed.length}곳입니다:\n${list}`,
      citations: delayed.map((s) => `progress_reports · ${s.code}`),
    };
  }

  if (q.includes("진행") && q.includes("몇")) {
    const count = sites.filter((s) => s.status === "in_progress").length;
    return {
      content: `현재 진행 중인 사업장은 ${count}곳입니다.`,
      citations: ["sites · status=in_progress"],
    };
  }

  if (q.includes("호원") || q.includes("의정부")) {
    const site = sites.find((s) => s.id === "site-hwawon");
    const pr = progressReports.find((p) => p.siteId === "site-hwawon");
    if (!site || !pr) return { content: "해당 사업장 정보를 찾을 수 없습니다.", citations: [] };
    return {
      content: `${site.name}의 최신 공정율은 ${pr.overallProgressPct}% (계획 ${pr.plannedProgressPct}%)입니다. 시공사: ${site.contractor}.`,
      citations: [pr.notes ?? "progress_reports", documents.find((d) => d.siteId === site.id)?.fileName ?? ""].filter(Boolean),
    };
  }

  if (q.includes("자금") || q.includes("집행")) {
    const site = sites.find((s) => q.includes("자양") ? s.id === "site-jayang" : s.id === "site-hwawon");
    const fund = fundSchedules.find((f) => f.siteId === site?.id);
    if (!site || !fund) {
      return { content: "집행 정보를 찾을 수 없습니다. 사업장명을 포함해 질문해 주세요.", citations: [] };
    }
    return {
      content: `${site.name} ${fund.scheduleMonth.slice(0, 7)} 실적 집행액 ${(fund.actualAmount! / 100_000_000).toFixed(1)}억원 (계획 ${(fund.plannedAmount / 100_000_000).toFixed(1)}억).`,
      citations: ["fund_schedules", documents.find((d) => d.siteId === site.id)?.fileName ?? ""].filter(Boolean),
    };
  }

  return {
    content: "질문을 이해했습니다. '지연 사업장', '진행 중 몇 곳', '호원동 공정율', '자금집행' 등으로 구체적으로 질문해 주세요.",
    citations: [],
  };
}

// Mutable store for upload demo (in-memory)
let uploadQueue: DocumentRecord[] = [...documents];

export function getDocuments(): DocumentRecord[] {
  return [...uploadQueue].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

export function addDocument(doc: DocumentRecord): void {
  uploadQueue = [doc, ...uploadQueue];
  if (doc.siteId) {
    const idx = documents.findIndex((d) => d.id === doc.id);
    if (idx >= 0) documents[idx] = doc;
    else documents.unshift({ ...doc });
  } else {
    documents.unshift({ ...doc });
  }
}

export { sites, progressReports, fundSchedules };
