import type { LabFund, LabProgressRow } from "@/lib/types";

/** 공정율현황 실적 → 화면용 실행공정율 (마스터 lab_funds는 변경하지 않음) */
export function mergeLabProgressIntoFunds(
  funds: LabFund[],
  progressRows: LabProgressRow[]
): LabFund[] {
  if (!progressRows.length) return funds;

  const byFundId = new Map<string, LabProgressRow>();
  const byLabName = new Map<string, LabProgressRow>();
  for (const row of progressRows) {
    if (row.labFundId) byFundId.set(row.labFundId, row);
    byLabName.set(row.labName.replace(/\s+/g, "").toLowerCase(), row);
  }

  return funds.map((fund) => {
    const row =
      byFundId.get(fund.id) ??
      byLabName.get(fund.name.replace(/\s+/g, "").toLowerCase());
    if (!row || row.actualProgressPct == null) return fund;
    return {
      ...fund,
      actualProgressPct: row.actualProgressPct,
      // 계획도 있으면 화면 일관성용으로 함께 반영 (마스터 DB는 그대로)
      plannedProgressPct:
        row.plannedProgressPct != null
          ? row.plannedProgressPct
          : fund.plannedProgressPct,
    };
  });
}
