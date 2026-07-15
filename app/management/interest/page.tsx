"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { sortLabFunds } from "@/lib/lab/portfolio-ui";
import { cn } from "@/lib/utils";
import type { LabFund, LabPortfolioSnapshot } from "@/lib/types";

type ViewMode = "list" | "calendar";

type DateItem = {
  key: string;
  fundName: string;
  siteAddress: string | null;
  date: string;
  label: string;
  kind: "distribution" | "maturity";
  raw?: string;
};

type CalendarEvent = {
  key: string;
  date: string;
  fundName: string;
  label: string;
  kind: "distribution" | "maturity";
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
        kind: "distribution",
        raw: p.raw,
      });
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.fundName.localeCompare(b.fundName, "ko"));
  return items;
}

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
        kind: "maturity",
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
        kind: "maturity",
      });
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.fundName.localeCompare(b.fundName, "ko"));
  return items;
}

function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: ({ day: number; iso: string } | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      day,
      iso: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function InterestPage() {
  const [portfolio, setPortfolio] = useState<LabPortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const now = todayStart();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });

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

  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [
      ...distributions.map((d) => ({
        key: d.key,
        date: d.date,
        fundName: d.fundName,
        label: d.label,
        kind: d.kind,
      })),
      ...maturities.map((m) => ({
        key: m.key,
        date: m.date,
        fundName: m.fundName,
        label: m.label,
        kind: m.kind,
      })),
    ];
    events.sort((a, b) => a.date.localeCompare(b.date));
    return events;
  }, [distributions, maturities]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of calendarEvents) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [calendarEvents]);

  const monthCells = useMemo(
    () => buildMonthCells(cursor.year, cursor.month),
    [cursor.year, cursor.month]
  );

  const viewTabs = (
    <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
      {(
        [
          ["list", "빠른 날짜순"],
          ["calendar", "달력"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setViewMode(id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            viewMode === id
              ? "bg-white text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <AppShell title="분배금/만기일 확인" action={portfolio ? viewTabs : undefined}>
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
            {viewMode === "list" ? (
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
            ) : (
              <CalendarBoard
                year={cursor.year}
                month={cursor.month}
                cells={monthCells}
                eventsByDate={eventsByDate}
                todayIso={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`}
                onPrev={() => shiftMonth(-1)}
                onNext={() => shiftMonth(1)}
                onToday={() =>
                  setCursor({ year: now.getFullYear(), month: now.getMonth() })
                }
              />
            )}

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <p className="text-xs text-muted">
                  회차별 스케줄 (설정일 → 대출만기일 → 만기일 → 상환일 → 1차…)
                </p>
              </div>
              <div className="max-h-[min(60vh,640px)] overflow-x-auto overflow-y-auto">
                <table className="w-max border-separate border-spacing-0 text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th className="sticky top-0 left-0 z-30 whitespace-nowrap bg-neutral-50 px-4 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        부동산랩
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-3 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        설정일
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-3 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        대출만기일
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-3 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        만기일
                      </th>
                      <th className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-3 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]">
                        상환일
                      </th>
                      {rounds.map((r) => (
                        <th
                          key={r}
                          className="sticky top-0 z-20 whitespace-nowrap bg-neutral-50 px-3 py-3 font-medium shadow-[inset_0_-1px_0_0_var(--color-border)]"
                        >
                          {r}차
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {funds.map((f) => {
                      const byRound = new Map(f.interestPayments.map((p) => [p.round, p]));
                      return (
                        <tr key={f.id} className="hover:bg-neutral-50/80">
                          <td className="sticky left-0 z-10 whitespace-nowrap border-t border-border bg-card px-4 py-2.5 font-medium">
                            {f.name}
                          </td>
                          <ScheduleCell date={f.setupDate} />
                          <ScheduleCell date={f.loanMaturityDate} />
                          <ScheduleCell date={f.maturityDate} />
                          <ScheduleCell date={f.repaymentDate} />
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

function CalendarBoard({
  year,
  month,
  cells,
  eventsByDate,
  todayIso,
  onPrev,
  onNext,
  onToday,
}: {
  year: number;
  month: number;
  cells: ({ day: number; iso: string } | null)[];
  eventsByDate: Map<string, CalendarEvent[]>;
  todayIso: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const title = `${year}년 ${month + 1}월`;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="rounded-md border border-border p-1.5 text-muted hover:bg-neutral-50 hover:text-foreground"
            aria-label="이전 달"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="min-w-[7rem] text-center text-sm font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onNext}
            className="rounded-md border border-border p-1.5 text-muted hover:bg-neutral-50 hover:text-foreground"
            aria-label="다음 달"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="ml-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-neutral-50 hover:text-foreground"
          >
            오늘
          </button>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" /> 분배금
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success" /> 만기
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-neutral-50 text-center text-[11px] font-medium text-muted">
        {weekdays.map((d) => (
          <div key={d} className="px-2 py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-[minmax(6.5rem,auto)]">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="border-t border-r border-border bg-neutral-50/40" />;
          }
          const events = eventsByDate.get(cell.iso) ?? [];
          const isToday = cell.iso === todayIso;
          return (
            <div
              key={cell.iso}
              className={cn(
                "min-h-[6.5rem] border-t border-r border-border p-1.5",
                isToday && "bg-blue-50/40"
              )}
            >
              <p
                className={cn(
                  "mb-1 text-[11px] tabular-nums",
                  isToday ? "font-semibold text-accent" : "text-muted"
                )}
              >
                {cell.day}
              </p>
              <div className="space-y-0.5">
                {events.slice(0, 3).map((e) => (
                  <div
                    key={e.key}
                    className={cn(
                      "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                      e.kind === "distribution"
                        ? "bg-blue-50 text-accent"
                        : "bg-green-50 text-success"
                    )}
                    title={`${e.fundName} · ${e.label}`}
                  >
                    {e.fundName} {e.label}
                  </div>
                ))}
                {events.length > 3 ? (
                  <p className="px-1 text-[10px] text-muted">+{events.length - 3}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
