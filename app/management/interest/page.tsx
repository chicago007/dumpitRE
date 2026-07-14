"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { sortLabFunds } from "@/lib/lab/portfolio-ui";
import type { LabFund, LabPortfolioSnapshot } from "@/lib/types";

type DateItem = {
  key: string;
  fundName: string;
  siteAddress: string | null;
  date: string;
  label: string;
  raw?: string;
};

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isValidIso(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(date).getTime());
}

function isOnOrAfterToday(date: string): boolean {
  if (!isValidIso(date)) return false;
  return new Date(date) >= todayStart();
}

/** 분배금(=회차) 지급일 — 오늘 이후만, 빠른 날짜순 */
function buildDistributionDates(funds: LabFund[]): DateItem[] {
  const items: DateItem[] = [];
  for (const fund of funds) {
    for (const p of fund.interestPayments) {
      if (!isOnOrAfterToday(p.date)) continue;
      items.push({
        key: `${fund.id}-pay-${p.round}-${p.date}`,
        fundName: fund.name,
        siteAddress: fund.siteAddress,
        date: p.date,
        label: `${p.round}회차`,
        raw: p.raw,
      });
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.fundName.localeCompare(b.fundName, "ko"));
  return items;
}

/** 만기일 — 만기·대출만기 중 오늘 이후, 빠른 날짜순 */
function buildMaturityDates(funds: LabFund[]): DateItem[] {
  const items: DateItem[] = [];
  for (const fund of funds) {
    if (fund.maturityDate && isOnOrAfterToday(fund.maturityDate)) {
      items.push({
        key: `${fund.id}-maturity-${fund.maturityDate}`,
        fundName: fund.name,
        siteAddress: fund.siteAddress,
        date: fund.maturityDate,
        label: "만기",
      });
    }
    if (
      fund.loanMaturityDate &&
      isOnOrAfterToday(fund.loanMaturityDate) &&
      fund.loanMaturityDate !== fund.maturityDate
    ) {
      items.push({
        key: `${fund.id}-loan-${fund.loanMaturityDate}`,
        fundName: fund.name,
        siteAddress: fund.siteAddress,
        date: fund.loanMaturityDate,
        label: "대출 만기일",
      });
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.fundName.localeCompare(b.fundName, "ko"));
  return items;
}

export default function InterestPage() {
  const [portfolio, setPortfolio] = useState<LabPortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

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

  const funds = useMemo(
    () => (portfolio ? sortLabFunds(portfolio.funds) : []),
    [portfolio]
  );

  const distributions = useMemo(() => buildDistributionDates(funds), [funds]);
  const maturities = useMemo(() => buildMaturityDates(funds), [funds]);
  const maxRound = useMemo(() => {
    const rounds = funds.flatMap((f) => f.interestPayments.map((p) => p.round));
    return Math.max(1, ...(rounds.length ? rounds : [0]));
  }, [funds]);
  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);

  return (
    <AppShell title="분배금/만기일 확인">
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
            <section className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">분배금/만기일 확인</h2>
              <p className="text-sm text-muted">
                위: 오늘 이후 일정(빠른 날짜순) · 아래: 설정일부터 회차·만기 전체 스케줄
              </p>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <DateList
                title="분배금 지급일"
                items={distributions}
                empty="예정된 분배금 지급일이 없습니다."
              />
              <DateList
                title="만기일"
                items={maturities}
                empty="예정된 만기일이 없습니다."
              />
            </div>

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">회차별 전체 스케줄</h3>
                <p className="text-xs text-muted">
                  설정일 → 분배금 회차 → 만기·대출만기·상환일 (전체 일정)
                </p>
              </div>
              <div className="max-h-[min(60vh,640px)] overflow-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="sticky top-0 left-0 z-30 bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        부동산랩
                      </th>
                      <th className="sticky top-0 z-20 bg-neutral-50 px-3 py-3 font-medium whitespace-nowrap shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        설정일
                      </th>
                      {rounds.map((r) => (
                        <th
                          key={r}
                          className="sticky top-0 z-20 bg-neutral-50 px-3 py-3 font-medium whitespace-nowrap shadow-[inset_0_-1px_0_0_var(--color-border)]"
                        >
                          {r}회차
                        </th>
                      ))}
                      <th className="sticky top-0 z-20 bg-neutral-50 px-3 py-3 font-medium whitespace-nowrap shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        만기
                      </th>
                      <th className="sticky top-0 z-20 bg-neutral-50 px-3 py-3 font-medium whitespace-nowrap shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        대출 만기일
                      </th>
                      <th className="sticky top-0 z-20 bg-neutral-50 px-3 py-3 font-medium whitespace-nowrap shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        상환일
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {funds.map((f) => {
                      const byRound = new Map(f.interestPayments.map((p) => [p.round, p]));
                      return (
                        <tr key={f.id} className="hover:bg-neutral-50/80">
                          <td className="sticky left-0 z-10 border-t border-border bg-card px-4 py-2.5">
                            <p className="font-medium whitespace-nowrap">{f.name}</p>
                            <p className="max-w-[160px] truncate text-xs text-muted">
                              {f.siteAddress ?? "—"}
                            </p>
                          </td>
                          <ScheduleCell date={f.setupDate} />
                          {rounds.map((r) => {
                            const p = byRound.get(r);
                            return (
                              <ScheduleCell
                                key={r}
                                date={p?.date ?? null}
                                display={p ? (p.raw ?? p.date) : null}
                              />
                            );
                          })}
                          <ScheduleCell date={f.maturityDate} />
                          <ScheduleCell date={f.loanMaturityDate} />
                          <ScheduleCell date={f.repaymentDate} />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ScheduleCell({
  date,
  display,
}: {
  date: string | null | undefined;
  display?: string | null;
}) {
  if (!date && !display) {
    return (
      <td className="border-t border-border px-3 py-2.5 text-xs whitespace-nowrap text-muted">—</td>
    );
  }
  const text = display ?? date ?? "—";
  const upcoming = date ? isOnOrAfterToday(date) : false;
  return (
    <td className="border-t border-border px-3 py-2.5 text-xs whitespace-nowrap tabular-nums">
      <span className={upcoming ? "font-medium text-accent" : "text-muted"}>{text}</span>
    </td>
  );
}

function DateList({
  title,
  items,
  empty,
}: {
  title: string;
  items: DateItem[];
  empty: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="max-h-[36rem] divide-y divide-border overflow-y-auto">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-muted">{empty}</p>
        ) : (
          items.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{item.fundName}</p>
                <p className="truncate text-xs text-muted">
                  {item.label}
                  {item.siteAddress ? ` · ${item.siteAddress}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums text-accent">
                {item.raw ?? item.date}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
