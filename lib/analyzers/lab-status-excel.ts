import * as XLSX from "xlsx";
import type { LabFund, LabFundStatus, LabInterestPayment, LabPortfolioSnapshot } from "@/lib/types";
import { sortLabFunds } from "@/lib/lab/portfolio-ui";

const HEADER_ALIASES: Record<string, string> = {
  랩서비스명: "name",
  상품코드: "productCode",
  편입펀드: "fundName",
  펀드코드: "fundCode",
  매입약정기관: "purchaseAgency",
  설정일: "setupDate",
  만기: "maturityDate",
  "대출 만기일": "loanMaturityDate",
  대출만기일: "loanMaturityDate",
  상환일: "repaymentDate",
  설정액: "setupAmount",
  잔액: "balance",
  금리: "interestRate",
  수수료율: "feeRate",
  신탁유형: "trustType",
  사업장: "siteAddress",
  사업내용: "businessDesc",
  계획공정율: "plannedProgressPct",
  실행공정율: "actualProgressPct",
  계획대비: "vsPlan",
  비고: "note",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cellToString(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return formatDate(value);
  }
  if (typeof value === "number") {
    // Excel serial date
    if (value > 20000 && value < 80000) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
      }
    }
    return String(value);
  }
  const s = String(value).trim();
  return s || null;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function cellToNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value).replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseInterestDate(value: unknown): { date: string; raw?: string } | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return { date: formatDate(value) };
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return {
        date: `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`,
      };
    }
  }
  const raw = String(value).trim();
  if (!raw) return null;
  // YYYY-MM-DD
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return {
      date: `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`,
    };
  }
  // "2023 10월 말" 등 비정형
  const loose = raw.match(/(\d{4})\s*(\d{1,2})\s*월/);
  if (loose) {
    return {
      date: `${loose[1]}-${loose[2].padStart(2, "0")}-28`,
      raw,
    };
  }
  return { date: raw, raw };
}

function resolveStatus(row: {
  balance: number | null;
  repaymentDate: string | null;
}): LabFundStatus {
  if (row.balance != null && row.balance === 0) return "repaid";
  if (row.repaymentDate && /^\d{4}-\d{2}-\d{2}$/.test(row.repaymentDate)) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const repay = new Date(row.repaymentDate);
    if (!Number.isNaN(repay.getTime()) && repay <= today && (row.balance == null || row.balance === 0)) {
      return "repaid";
    }
  }
  if (row.balance != null && row.balance > 0) return "active";
  if (row.balance == null && !row.repaymentDate) return "unknown";
  if (row.balance == null && row.repaymentDate) return "repaid";
  return "active";
}

export function parseLabStatusExcel(
  buffer: Buffer,
  fileName: string
): LabPortfolioSnapshot {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("엑셀 시트가 비어 있습니다");
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  if (rows.length < 2) {
    throw new Error("헤더/데이터 행이 없습니다");
  }

  const headerRow = rows[0] as unknown[];
  const colMap = new Map<number, string>();
  const interestCols: { index: number; round: number }[] = [];

  headerRow.forEach((h, i) => {
    const label = normalizeHeader(h);
    if (!label) return;
    const interestMatch = label.match(/^(\d+)\s*회차\s*지급일$/);
    if (interestMatch) {
      interestCols.push({ index: i, round: Number(interestMatch[1]) });
      return;
    }
    const key = HEADER_ALIASES[label];
    if (key) colMap.set(i, key);
  });

  if (![...colMap.values()].includes("name")) {
    throw new Error("‘랩서비스명’ 컬럼을 찾을 수 없습니다. 관리현황 엑셀인지 확인해 주세요.");
  }

  const funds: LabFund[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    if (!row || row.every((c) => c == null || c === "")) continue;

    const get = (key: string): unknown => {
      for (const [idx, k] of colMap) {
        if (k === key) return row[idx];
      }
      return null;
    };

    const name = cellToString(get("name"));
    if (!name) continue;

    const balance = cellToNumber(get("balance"));
    const repaymentDate = cellToString(get("repaymentDate"));
    const setupAmount = cellToNumber(get("setupAmount"));

    const interestPayments: LabInterestPayment[] = [];
    for (const { index, round } of interestCols.sort((a, b) => a.round - b.round)) {
      const parsed = parseInterestDate(row[index]);
      if (!parsed) continue;
      interestPayments.push({ round, date: parsed.date, raw: parsed.raw });
    }

    const fund: LabFund = {
      id: `lab-${String(get("productCode") ?? name).replace(/\s+/g, "")}`,
      name,
      productCode: cellToString(get("productCode")),
      fundName: cellToString(get("fundName")),
      fundCode: cellToString(get("fundCode")),
      purchaseAgency: cellToString(get("purchaseAgency")),
      setupDate: cellToString(get("setupDate")),
      maturityDate: cellToString(get("maturityDate")),
      loanMaturityDate: cellToString(get("loanMaturityDate")),
      repaymentDate,
      setupAmount,
      balance,
      interestRate: cellToNumber(get("interestRate")),
      feeRate: cellToNumber(get("feeRate")),
      trustType: cellToString(get("trustType")),
      siteAddress: cellToString(get("siteAddress")),
      businessDesc: cellToString(get("businessDesc")),
      plannedProgressPct: cellToNumber(get("plannedProgressPct")),
      actualProgressPct: cellToNumber(get("actualProgressPct")),
      vsPlan: cellToString(get("vsPlan")),
      note: cellToString(get("note")),
      interestPayments,
      status: resolveStatus({ balance, repaymentDate }),
    };

    funds.push(fund);
  }

  const ordered = sortLabFunds(funds);
  const active = ordered.filter((f) => f.status === "active");
  const repaid = ordered.filter((f) => f.status === "repaid");

  return {
    uploadedAt: new Date().toISOString(),
    fileName,
    funds: ordered,
    stats: {
      totalCount: ordered.length,
      activeCount: active.length,
      repaidCount: repaid.length,
      totalSetupAmount: ordered.reduce((s, f) => s + (f.setupAmount ?? 0), 0),
      totalBalance: ordered.reduce((s, f) => s + (f.balance ?? 0), 0),
    },
  };
}

export function isLabStatusExcelFile(fileName: string): boolean {
  const n = fileName.toLowerCase();
  return (
    (n.endsWith(".xlsx") || n.endsWith(".xls")) &&
    (n.includes("랩현황") || n.includes("관리현황") || n.includes("lab") || n.includes("현황"))
  );
}
