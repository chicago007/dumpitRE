"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
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
  if (status === "active") return <Badge variant="success">운용중</Badge>;
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

  const progressReady = useMemo(() => {
    if (!portfolio) return 0;
    return portfolio.funds.filter((f) => f.actualProgressPct != null).length;
  }, [portfolio]);

  return (
    <AppShell title="전체 현황">
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
            <section className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">전체 현황</h2>
                <p className="mt-1 text-sm text-muted">
                  {portfolio.fileName} · {new Date(portfolio.uploadedAt).toLocaleString("ko-KR")}
                  {" · "}공정율 데이터 {progressReady}/{portfolio.stats.totalCount}건
                </p>
              </div>
              <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
                {(
                  [
                    ["all", "전체"],
                    ["active", "운용중"],
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
            </section>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard value={portfolio.stats.totalCount} label="총 랩 수" tone="warning" />
              <StatCard
                value={portfolio.stats.activeCount}
                label="운용중"
                tone="info"
              />
              <StatCard
                value={formatCurrency(portfolio.stats.totalSetupAmount)}
                label="설정액 합계"
                tone="info"
              />
              <StatCard
                value={formatCurrency(portfolio.stats.totalBalance)}
                label="잔액 합계"
                tone="success"
              />
              <StatCard
                value={progressReady > 0 ? `${progressReady}건` : "—"}
                label="공정율 입력"
                tone="default"
                hint="자료 연동 예정"
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">포트폴리오 목록</h3>
                <p className="text-xs text-muted">
                  랩명·사업장을 누르면 사업장별(회차별) 현황으로 이동합니다. 아래로 스크롤해도
                  컬럼명은 고정됩니다.
                </p>
              </div>
              <div className="max-h-[min(70vh,720px)] overflow-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="sticky top-0 left-0 z-30 bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        랩
                      </th>
                      <th className="sticky top-0 z-20 bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        사업장
                      </th>
                      <th className="sticky top-0 z-20 bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        약정
                      </th>
                      <th className="sticky top-0 z-20 bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        설정액
                      </th>
                      <th className="sticky top-0 z-20 bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        잔액
                      </th>
                      <th className="sticky top-0 z-20 bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        금리
                      </th>
                      <th className="sticky top-0 z-20 min-w-[140px] bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        공정율
                      </th>
                      <th className="sticky top-0 z-20 bg-neutral-50 px-4 py-3 font-medium whitespace-nowrap shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        설정일
                      </th>
                      <th className="sticky top-0 z-20 bg-neutral-50 px-4 py-3 font-medium whitespace-nowrap shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        만기
                      </th>
                      <th className="sticky top-0 z-20 bg-neutral-50 px-4 py-3 font-medium whitespace-nowrap shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        대출 만기일
                      </th>
                      <th className="sticky top-0 z-20 bg-neutral-50 px-4 py-3 font-medium whitespace-nowrap shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        상환일
                      </th>
                      <th className="sticky top-0 z-20 bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        상태
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {funds.map((f) => {
                      const key = siteKey(f);
                      return (
                        <tr key={f.id} className="hover:bg-neutral-50/90">
                          <td className="sticky left-0 z-10 border-t border-border bg-card px-4 py-3">
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
                          <td className="max-w-[220px] border-t border-border px-4 py-3">
                            <Link
                              href={`/management/sites?site=${encodeSiteParam(key)}`}
                              className="font-medium text-accent hover:underline"
                            >
                              {f.siteAddress ?? "사업장 미기재"}
                            </Link>
                            <p className="truncate text-xs text-muted">{f.businessDesc}</p>
                          </td>
                          <td className="border-t border-border px-4 py-3">{f.purchaseAgency ?? "—"}</td>
                          <td className="border-t border-border px-4 py-3 tabular-nums">
                            {f.setupAmount != null ? formatCurrency(f.setupAmount) : "—"}
                          </td>
                          <td className="border-t border-border px-4 py-3 tabular-nums">
                            {f.balance != null ? formatCurrency(f.balance) : "—"}
                          </td>
                          <td className="border-t border-border px-4 py-3 tabular-nums">
                            {formatRate(f.interestRate)}
                          </td>
                          <td className="border-t border-border px-4 py-3">
                            <ProgressBar value={f.actualProgressPct} label="실행" tone="green" />
                            <div className="mt-1.5">
                              <ProgressBar value={f.plannedProgressPct} label="계획" tone="blue" />
                            </div>
                          </td>
                          <td className="border-t border-border px-4 py-3 whitespace-nowrap text-xs tabular-nums">
                            {f.setupDate ?? "—"}
                          </td>
                          <td className="border-t border-border px-4 py-3 whitespace-nowrap text-xs tabular-nums">
                            {f.maturityDate ?? "—"}
                          </td>
                          <td className="border-t border-border px-4 py-3 whitespace-nowrap text-xs tabular-nums">
                            {f.loanMaturityDate ?? "—"}
                          </td>
                          <td className="border-t border-border px-4 py-3 whitespace-nowrap text-xs tabular-nums">
                            {f.repaymentDate ?? "—"}
                          </td>
                          <td className="border-t border-border px-4 py-3">{statusBadge(f.status)}</td>
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
