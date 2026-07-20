/** 기성보고서에서 뽑은 원시 필드 (포트폴리오 매칭 전) */
export interface GisungExtracted {
  fileName: string;
  documentKind:
    | "gisung"
    | "process_confirm"
    | "permit_approval"
    | "permit_business_plan"
    | "permit_start"
    | "unknown";
  /** 본문/대지위치에서 찾은 주소 */
  siteAddress: string | null;
  /** 공사명 (『…』 또는 용역명) */
  projectName: string | null;
  /** 제목에서 추정한 펀드 호수 (예: 75) */
  fundRoundHint: number | null;
  /** 파일명 복수 호수 (예: 67,68호 → [67,68]) */
  fundRoundHints?: number[];
  /** 본문/제목에서 뽑은 펀드명 조각 */
  fundNameHint?: string | null;
  /** 시행·시공·사업자 등 */
  operatorHints?: string[];
  /** 인허가·사업계획·착공 필증 등 표시용 라벨 */
  permitLabel?: string | null;
  reportRound: number | null;
  reportDate: string | null;
  /** 누계(%) 합계 */
  plannedProgressPct: number | null;
  actualProgressPct: number | null;
  achievementPct: number | null;
  /** 예정공정 대비 지연일수 */
  delayDays: number | null;
  /** 지연 사유 등 */
  delayReason: string | null;
  /** 특이사항 원문 조각 */
  specialNotesRaw: string[];
  /** 특이사항 요약 (규칙 기반) */
  specialNotesSummary: string | null;
}

export interface PortfolioMatchCandidate {
  labName: string;
  fundName: string | null;
  fundCode: string | null;
  siteAddress: string | null;
  status: string;
  plannedProgressPct: number | null;
  actualProgressPct: number | null;
  score: number;
}

/** 최종 요약 리포트 */
export interface ProgressSummaryReport {
  labName: string | null;
  fundName: string | null;
  siteAddress: string | null;
  /** 기성실사/확인 일자 (보고서 일자) */
  confirmedDate: string | null;
  plannedProgressPct: number | null;
  actualProgressPct: number | null;
  achievementPct: number | null;
  delayDays: number | null;
  specialNotes: string | null;
  matchConfidence: "high" | "medium" | "low" | "none";
  matchCandidates: PortfolioMatchCandidate[];
  source: GisungExtracted;
}
