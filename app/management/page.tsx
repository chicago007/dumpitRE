"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { RatioBars } from "@/components/management/ratio-donut";
import { Badge } from "@/components/ui/badge";
import {
  encodeSiteParam,
  formatRate,
  siteKey,
  sortLabFunds,
} from "@/lib/lab/portfolio-ui";
import { formatCurrency } from "@/lib/utils";
import type { LabFund, LabPortfolioSnapshot } from "@/lib/types";

type Filter = "all" | "active" | "repaid";

function statusBadge(status: LabFund["status"]) {
  if (status === "active") return <Badge variant="success">진행중</Badge>;
  if (status === "repaid") return <Badge variant="default">상환완료</Badge>;
  return <Badge>미확인</Badge>;
}

export default function ManagementOverviewPage() {
  const [portfolio, setPortfolio] = useState<LabPortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(() => {
    setLoading(true);
    fetch("/api/lab-portfolio")
      .then((r) => r.json())
      .then((data) => setPortfolio(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const funds = useMemo(() => {
    if (!portfolio) return [];
    const list =
      filter === "all" ? portfolio.funds : portfolio.funds.filter((f) => f.status === filter);
    return sortLabFunds(list);
  }, [portfolio, filter]);

  const filterTabs = (
    <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
      {(
        [
          ["all", "전체"],
          ["active", "진행중"],
          ["repaid", "상환"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setFilter(id)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === id
              ? "bg-white text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <AppShell title="전체 현황" action={portfolio ? filterTabs : undefined}>
      <div className="mx-auto max-w-7xl space-y-6">
        {loading && !portfolio ? (
          <p className="text-sm text-muted">불러오는 중…</p>
        ) : !portfolio ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
            <p className="text-sm text-muted">아직 업로드된 관리현황이 없습니다.</p>
            <Link href="/upload" className="mt-3 inline-block text-sm text-accent hover:underline">
              업로드에서 관리현황 엑셀 올리기
            </Link>
          </div>
        ) : (
          <>
            <RatioBars
              items={[
                {
                  label: "진행 비중",
                  numeratorLabel: "진행중",
                  denominatorLabel: "총 사업장수",
                  numeratorValue: portfolio.stats.activeCount.toLocaleString("ko-KR"),
                  denominatorValue: portfolio.stats.totalCount.toLocaleString("ko-KR"),
                  ratio:
                    portfolio.stats.totalCount > 0
                      ? portfolio.stats.activeCount / portfolio.stats.totalCount
                      : 0,
                  barClass: "bg-accent",
                },
                {
                  label: "잔액 / 설정액",
                  numeratorLabel: "잔액",
                  denominatorLabel: "설정액",
                  numeratorValue: formatCurrency(portfolio.stats.totalBalance),
                  denominatorValue: formatCurrency(portfolio.stats.totalSetupAmount),
                  ratio:
                    portfolio.stats.totalSetupAmount > 0
                      ? portfolio.stats.totalBalance / portfolio.stats.totalSetupAmount
                      : 0,
                  barClass: "bg-success",
                },
              ]}
            />

            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs text-muted">
                  목록 (랩·사업장명을 누르면 사업장별 현황으로 이동합니다)
                </p>
              </div>
              <div className="max-h-[min(70vh,720px)] overflow-x-auto overflow-y-auto">
                <table className="w-max border-separate border-spacing-0 text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="sticky top-0 left-0 z-30 whitespace-nowrap bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        랩
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        사업장
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        약정
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        설정액
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        잔액
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        금리
                      </th>
                      <th className="sticky top-0 z-20 min-w-[120px] whitespace-nowrap bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        실행공정율
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        설정일
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        만기
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        대출 만기일
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        상환일
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        상태
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {funds.map((f) => {
                      const key = siteKey(f);
                      return (
                        <tr key={f.id} className="hover:bg-neutral-50/90">
                          <td className="sticky left-0 z-10 whitespace-nowrap border-t border-border bg-card px-4 py-3">
                            <Link
                              href={`/management/sites?lab=${encodeURIComponent(f.id)}`}
                              className="font-medium text-accent hover:underline"
                            >
                              {f.name}
                            </Link>
                            <p className="text-xs text-muted">
                              {[f.fundName, f.fundCode].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </td>
                          <td className="whitespace-nowrap border-t border-border px-4 py-3">
                            <Link
                              href={`/management/sites?site=${encodeSiteParam(key)}`}
                              className="font-medium text-accent hover:underline"
                            >
                              {f.siteAddress ?? "사업장 미기재"}
                            </Link>
                            {f.businessDesc ? (
                              <p className="text-xs text-muted">{f.businessDesc}</p>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap border-t border-border px-4 py-3">
                            {f.purchaseAgency ?? "—"}
                          </td>
                          <td className="whitespace-nowrap border-t border-border px-4 py-3 tabular-nums">
                            {f.setupAmount != null ? formatCurrency(f.setupAmount) : "—"}
                          </td>
                          <td className="whitespace-nowrap border-t border-border px-4 py-3 tabular-nums">
                            {f.balance != null ? formatCurrency(f.balance) : "—"}
                          </td>
                          <td className="whitespace-nowrap border-t border-border px-4 py-3 tabular-nums">
                            {formatRate(f.interestRate)}
                          </td>
                          <td className="whitespace-nowrap border-t border-border px-4 py-3 text-sm tabular-nums">
                            {f.actualProgressPct != null
                              ? `${Math.round(f.actualProgressPct)}%`
                              : "—"}
                          </td>
                          <td className="whitespace-nowrap border-t border-border px-4 py-3 text-xs tabular-nums">
                            {f.setupDate ?? "—"}
                          </td>
                          <td className="whitespace-nowrap border-t border-border px-4 py-3 text-xs tabular-nums">
                            {f.maturityDate ?? "—"}
                          </td>
                          <td className="whitespace-nowrap border-t border-border px-4 py-3 text-xs tabular-nums">
                            {f.loanMaturityDate ?? "—"}
                          </td>
                          <td className="whitespace-nowrap border-t border-border px-4 py-3 text-xs tabular-nums">
                            {f.repaymentDate ?? "—"}
                          </td>
                          <td className="whitespace-nowrap border-t border-border px-4 py-3">
                            {statusBadge(f.status)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
