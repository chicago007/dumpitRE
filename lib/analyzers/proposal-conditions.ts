import type { ParsedProposal } from "@/lib/analyzers/proposal";
import { formatCurrency } from "@/lib/utils";

/** 투자 주요 조건 표 행 정의 (추출 프롬프트 항목과 대응) */
export const PROPOSAL_CONDITION_ROWS: {
  key: keyof ParsedProposal | "totalBudgetEok";
  label: string;
  format: (p: ParsedProposal) => string;
}[] = [
  { key: "labName", label: "랩명", format: (p) => p.labName?.trim() || "—" },
  { key: "fundName", label: "펀드명", format: (p) => p.fundName?.trim() || "—" },
  {
    key: "purchaseAgency",
    label: "매입기관",
    format: (p) => p.purchaseAgency?.trim() || "—",
  },
  { key: "setupDate", label: "설정일", format: (p) => p.setupDate?.trim() || "—" },
  {
    key: "loanMaturityDate",
    label: "대출만기일",
    format: (p) => p.loanMaturityDate?.trim() || "—",
  },
  {
    key: "maturityDate",
    label: "펀드만기일",
    format: (p) => p.maturityDate?.trim() || "—",
  },
  {
    key: "interestRate",
    label: "금리",
    format: (p) =>
      p.interestRate != null && Number.isFinite(p.interestRate)
        ? `${p.interestRate}%`
        : "—",
  },
  {
    key: "feeRate",
    label: "수수료율",
    format: (p) =>
      p.feeRate != null && Number.isFinite(p.feeRate) ? `${p.feeRate}%` : "—",
  },
  {
    key: "trustCompany",
    label: "신탁사",
    format: (p) => p.trustCompany?.trim() || "—",
  },
  { key: "developer", label: "시행사", format: (p) => p.developer?.trim() || "—" },
  {
    key: "contractor",
    label: "시공사",
    format: (p) => p.contractor?.trim() || "—",
  },
  { key: "trustType", label: "신탁방식", format: (p) => p.trustType?.trim() || "—" },
  {
    key: "businessDesc",
    label: "사업내용",
    format: (p) => p.businessDesc?.trim() || "—",
  },
  { key: "location", label: "사업장 주소", format: (p) => p.location?.trim() || "—" },
  { key: "landArea", label: "대지면적", format: (p) => p.landArea?.trim() || "—" },
  {
    key: "buildingArea",
    label: "건축면적",
    format: (p) => p.buildingArea?.trim() || "—",
  },
  {
    key: "totalFloorArea",
    label: "연면적",
    format: (p) => p.totalFloorArea?.trim() || "—",
  },
  {
    key: "buildingScale",
    label: "건축규모",
    format: (p) => p.buildingScale?.trim() || "—",
  },
  {
    key: "householdCount",
    label: "세대수",
    format: (p) => p.householdCount?.trim() || "—",
  },
  {
    key: "totalBudgetEok",
    label: "설정액·규모",
    format: (p) =>
      p.totalBudget != null && Number.isFinite(p.totalBudget)
        ? formatCurrency(p.totalBudget)
        : "—",
  },
];

export type ProposalConditionColumn = {
  documentId: string;
  fileName: string;
  columnLabel: string;
  parsed: ParsedProposal;
  extractionSource?: "gemini" | "regex";
  extractionWarning?: string;
};

export function buildConditionColumnLabel(
  parsed: ParsedProposal,
  fileName: string
): string {
  return parsed.labName?.trim() || parsed.siteName?.trim() || fileName;
}

/** 비교표를 CSV 문자열로 (엑셀에 붙여넣기 가능) */
export function proposalConditionsToCsv(columns: ProposalConditionColumn[]): string {
  const header = ["항목", ...columns.map((c) => c.columnLabel)];
  const rows = PROPOSAL_CONDITION_ROWS.map((row) => [
    row.label,
    ...columns.map((c) => {
      const v = row.format(c.parsed);
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }),
  ]);
  return [header, ...rows].map((r) => r.join(",")).join("\n");
}
