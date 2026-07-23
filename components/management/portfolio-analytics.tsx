"use client";

import { useMemo, useState } from "react";
import type { LabFund } from "@/lib/types";
import {
  aggregateByEntity,
  aggregateByRegion,
  aggregateInterestByPeriod,
  aggregateMaturityByPeriod,
  aggregateFeeByPeriod,
  aggregateSetupRepayment,
  amountToEok,
  fillInterestMonthlyGaps,
  fillMaturityMonthlyGaps,
  fillMonthlyFeeGaps,
  fillMonthlyGaps,
  filterRowsByYear,
  listEntityDetails,
  listFeeDetails,
  listInterestDetails,
  listMaturityDetails,
  listRegionDetails,
  listSetupRepaymentDetails,
  yearsFromPeriodKeys,
  type DrillDownItem,
  type EntityAggregate,
  type InterestMonthRow,
  type MaturityMonthRow,
  type PeriodAmountRow,
  type PeriodFeeRow,
  type PeriodMode,
  type RegionAggregate,
} from "@/lib/lab/portfolio-analytics";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { FundStatusHoverBubble } from "@/components/management/fund-status-tooltip";

type EntityTab = "trustCompany" | "developer" | "contractor" | "purchaseAgency";

const CURRENT_YEAR = String(new Date().getFullYear());

const ENTITY_TABS: { id: EntityTab; label: string }[] = [
  { id: "trustCompany", label: "신탁사" },
  { id: "developer", label: "시행사" },
  { id: "contractor", label: "시공사" },
  { id: "purchaseAgency", label: "매입기관" },
];

function ChartCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="shadow-card rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PeriodToggle({
  mode,
  onChange,
}: {
  mode: PeriodMode;
  onChange: (m: PeriodMode) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-border bg-background p-0.5">
      {(
        [
          ["year", "연도별"],
          ["month", "월별"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            mode === id
              ? "bg-accent text-accent-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function YearSelect({
  years,
  value,
  onChange,
}: {
  years: string[];
  value: string | null;
  onChange: (year: string | null) => void;
}) {
  if (years.length === 0) return null;

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground"
      aria-label="연도 선택"
    >
      <option value="">전체 연도</option>
      {years.map((year) => (
        <option key={year} value={year}>
          {year}년
        </option>
      ))}
    </select>
  );
}

function PeriodChartControls({
  mode,
  onModeChange,
  years,
  year,
  onYearChange,
}: {
  mode: PeriodMode;
  onModeChange: (m: PeriodMode) => void;
  years: string[];
  year: string | null;
  onYearChange: (y: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PeriodToggle mode={mode} onChange={onModeChange} />
      {mode === "month" ? (
        <YearSelect years={years} value={year} onChange={onYearChange} />
      ) : null}
    </div>
  );
}

function usePeriodView<T extends { key: string; label: string }>(
  allRows: T[],
  mode: PeriodMode,
  year: string | null,
  fillYear: (rows: T[], year: string) => T[]
) {
  return useMemo(() => {
    if (mode === "year") return allRows;
    const filtered = filterRowsByYear(allRows, year);
    if (!year) return filtered;
    const filled = fillYear(filtered, year);
    return filled.map((row) => {
      const month = row.key.split("-")[1];
      return month ? { ...row, label: `${Number(month)}월` } : row;
    });
  }, [allRows, mode, year, fillYear]);
}

function EmptyChart({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted">
      {message}
    </p>
  );
}

function DrillDownList({
  items,
  funds,
}: {
  items: DrillDownItem[];
  funds: LabFund[];
}) {
  const fundById = useMemo(() => new Map(funds.map((f) => [f.id, f])), [funds]);

  if (items.length === 0) {
    return <p className="text-sm text-muted">해당 항목이 없습니다.</p>;
  }

  return (
    <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
      {items.map((item) => {
        const fund = fundById.get(item.fundId);
        return (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
          >
            <div className="min-w-0">
              {fund ? (
                <FundStatusHoverBubble fund={fund}>
                  <span className="font-medium">{item.fundName}</span>
                </FundStatusHoverBubble>
              ) : (
                <p className="font-medium">{item.fundName}</p>
              )}
              {item.sublabel ? (
                <p className="truncate text-xs text-muted">{item.sublabel}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right text-xs tabular-nums">
              {item.amount != null ? (
                <p className="font-medium text-foreground">{formatCurrency(item.amount)}</p>
              ) : null}
              {item.date ? <p className="text-muted">{item.date}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ChartDrillDown({
  title,
  summary,
  children,
}: {
  title: string;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="mt-1.5 text-xs text-muted">{summary}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function formatEokText(amount: number): string {
  const eok = amountToEok(amount);
  return eok >= 1 ? `${eok.toFixed(1)}억` : `${(eok * 10).toFixed(1)}천만`;
}

/** 설정 vs 상환 이중 막대 */
function SetupRepaymentChart({
  rows,
  selectedKey,
  onSelect,
}: {
  rows: PeriodAmountRow[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  if (rows.length === 0) {
    return <EmptyChart message="설정일·상환일 데이터가 없습니다." />;
  }

  const max = Math.max(...rows.flatMap((r) => [r.setup, r.repayment]), 1);
  const barW = Math.min(28, Math.max(8, 480 / rows.length / 2.5));
  const gap = 4;
  const groupW = barW * 2 + gap;
  const w = Math.max(400, rows.length * (groupW + 12) + 48);
  const h = 200;
  const pad = { top: 16, right: 12, bottom: 36, left: 44 };
  const innerH = h - pad.top - pad.bottom;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-full" role="img" aria-label="설정액 상환액">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad.top + innerH * (1 - t);
          const val = amountToEok(max * t);
          return (
            <g key={t}>
              <line
                x1={pad.left}
                y1={y}
                x2={w - pad.right}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
              <text x={pad.left - 6} y={y + 4} textAnchor="end" className="fill-muted text-[9px]">
                {val >= 1 ? `${val.toFixed(0)}억` : `${(val * 10).toFixed(0)}천만`}
              </text>
            </g>
          );
        })}
        {rows.map((row, i) => {
          const x0 = pad.left + i * (groupW + 12);
          const setupH = (row.setup / max) * innerH;
          const repayH = (row.repayment / max) * innerH;
          const selected = selectedKey === row.key;
          const hasData = row.setup > 0 || row.repayment > 0;
          return (
            <g
              key={row.key}
              className={hasData ? "cursor-pointer" : undefined}
              onClick={() => onSelect(selected ? null : hasData ? row.key : null)}
              role={hasData ? "button" : undefined}
              aria-pressed={selected}
            >
              {selected ? (
                <rect
                  x={x0 - 2}
                  y={pad.top - 4}
                  width={groupW + 4}
                  height={innerH + 8}
                  rx={4}
                  fill="var(--color-accent)"
                  opacity={0.08}
                />
              ) : null}
              <rect
                x={x0}
                y={pad.top + innerH - setupH}
                width={barW}
                height={Math.max(setupH, row.setup > 0 ? 2 : 0)}
                rx={3}
                fill="#00c7a9"
                opacity={selected || !selectedKey ? 1 : 0.45}
              />
              <rect
                x={x0 + barW + gap}
                y={pad.top + innerH - repayH}
                width={barW}
                height={Math.max(repayH, row.repayment > 0 ? 2 : 0)}
                rx={3}
                fill="#d1b5ff"
                opacity={selected || !selectedKey ? 1 : 0.45}
              />
              <text
                x={x0 + groupW / 2}
                y={h - 10}
                textAnchor="middle"
                className={cn("text-[9px]", selected ? "fill-foreground font-medium" : "fill-muted")}
              >
                {row.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-im-mint" /> 설정액
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-im-purple" /> 상환액
        </span>
        <span className="text-muted/80">막대를 클릭하면 상세 목록이 표시됩니다.</span>
      </div>
    </div>
  );
}

function HorizontalRankChart({
  rows,
  valueLabel,
  selectedLabel,
  onSelect,
}: {
  rows: (EntityAggregate | RegionAggregate)[];
  valueLabel: string;
  selectedLabel: string | null;
  onSelect: (label: string | null) => void;
}) {
  if (rows.length === 0) {
    return <EmptyChart message="집계할 데이터가 없습니다." />;
  }

  const max = Math.max(...rows.map((r) => r.amount), 1);

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const pct = Math.max(4, (row.amount / max) * 100);
        const selected = selectedLabel === row.label;
        return (
          <li key={row.label}>
            <button
              type="button"
              onClick={() => onSelect(selected ? null : row.label)}
              className={cn(
                "w-full rounded-lg px-2 py-1.5 text-left transition-colors",
                selected ? "bg-accent/10 ring-1 ring-accent/30" : "hover:bg-background"
              )}
            >
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium text-foreground" title={row.label}>
                  {row.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {formatCurrency(row.amount)} · {row.count}건
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    selected ? "bg-accent" : "bg-accent/70"
                  )}
                  style={{ width: `${pct}%` }}
                  title={`${valueLabel}: ${formatCurrency(row.amount)}`}
                />
              </div>
            </button>
          </li>
        );
      })}
      <p className="text-xs text-muted/80">막대를 클릭하면 상세 목록이 표시됩니다.</p>
    </ul>
  );
}

function MaturityTimelineChart({
  rows,
  selectedKey,
  onSelect,
  showEarly,
  showLoan,
  showFund,
}: {
  rows: MaturityMonthRow[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  showEarly: boolean;
  showLoan: boolean;
  showFund: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyChart message="만기일 데이터가 없습니다." />;
  }

  const visibleCount = (r: MaturityMonthRow) =>
    (showEarly ? r.earlyCount : 0) +
    (showLoan ? r.loanCount : 0) +
    (showFund ? r.fundCount : 0);

  const visibleAmount = (r: MaturityMonthRow) =>
    (showEarly ? r.earlyAmount : 0) +
    (showLoan ? r.loanAmount : 0) +
    (showFund ? r.fundAmount : 0);

  const max = Math.max(...rows.map(visibleAmount), 1);
  const barW = Math.min(24, Math.max(10, 480 / rows.length));
  const w = Math.max(400, rows.length * (barW + 8) + 48);
  const h = 200;
  const pad = { top: 24, right: 12, bottom: 36, left: 32 };
  const innerH = h - pad.top - pad.bottom;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-full" role="img" aria-label="만기 캘린더">
        {rows.map((row, i) => {
          const x = pad.left + i * (barW + 8);
          const count = visibleCount(row);
          const selected = selectedKey === row.key;
          const hasData = count > 0;
          // 금액이 0이어도 건수가 있으면 최소 높이로 표시
          const scaleEarly = showEarly
            ? row.earlyAmount > 0
              ? row.earlyAmount
              : row.earlyCount > 0
                ? max * 0.04
                : 0
            : 0;
          const scaleLoan = showLoan
            ? row.loanAmount > 0
              ? row.loanAmount
              : row.loanCount > 0
                ? max * 0.04
                : 0
            : 0;
          const scaleFund = showFund
            ? row.fundAmount > 0
              ? row.fundAmount
              : row.fundCount > 0
                ? max * 0.04
                : 0
            : 0;
          const earlyH = (scaleEarly / max) * innerH;
          const loanH = (scaleLoan / max) * innerH;
          const fundH = (scaleFund / max) * innerH;
          const totalH = earlyH + loanH + fundH;
          return (
            <g
              key={row.key}
              className={hasData ? "cursor-pointer" : undefined}
              onClick={() => onSelect(selected ? null : hasData ? row.key : null)}
              role={hasData ? "button" : undefined}
              aria-pressed={selected}
            >
              {selected ? (
                <rect
                  x={x - 2}
                  y={pad.top - 4}
                  width={barW + 4}
                  height={innerH + 8}
                  rx={4}
                  fill="var(--color-accent)"
                  opacity={0.08}
                />
              ) : null}
              {showEarly && (row.earlyAmount > 0 || row.earlyCount > 0) ? (
                <rect
                  x={x}
                  y={pad.top + innerH - earlyH - loanH - fundH}
                  width={barW}
                  height={Math.max(earlyH, 1)}
                  rx={2}
                  fill="#f59e0b"
                  opacity={selected || !selectedKey ? 1 : 0.45}
                />
              ) : null}
              {showLoan && (row.loanAmount > 0 || row.loanCount > 0) ? (
                <rect
                  x={x}
                  y={pad.top + innerH - loanH - fundH}
                  width={barW}
                  height={Math.max(loanH, 1)}
                  rx={2}
                  fill="#7db5ff"
                  opacity={selected || !selectedKey ? 1 : 0.45}
                />
              ) : null}
              {showFund && (row.fundAmount > 0 || row.fundCount > 0) ? (
                <rect
                  x={x}
                  y={pad.top + innerH - fundH}
                  width={barW}
                  height={Math.max(fundH, 1)}
                  rx={2}
                  fill="#53e1e5"
                  opacity={selected || !selectedKey ? 1 : 0.45}
                />
              ) : null}
              {count > 0 ? (
                <text
                  x={x + barW / 2}
                  y={pad.top + innerH - totalH - 4}
                  textAnchor="middle"
                  className={cn(
                    "text-[9px] tabular-nums",
                    selected ? "fill-foreground font-semibold" : "fill-muted"
                  )}
                >
                  {count}
                </text>
              ) : null}
              <text
                x={x + barW / 2}
                y={h - 10}
                textAnchor="middle"
                className={cn("text-[8px]", selected ? "fill-foreground font-medium" : "fill-muted")}
              >
                {row.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> 중도상환 (
          {rows.reduce((s, r) => s + r.earlyCount, 0)}건)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-im-blue" /> 대출만기 (
          {rows.reduce((s, r) => s + r.loanCount, 0)}건)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-im-light-blue" /> 펀드만기 (
          {rows.reduce((s, r) => s + r.fundCount, 0)}건)
        </span>
        <span className="text-muted/80">막대 높이=금액 · 숫자=건수 · 클릭 시 상세</span>
      </div>
    </div>
  );
}

function InterestScheduleChart({
  rows,
  periodMode,
  selectedKey,
  onSelect,
}: {
  rows: InterestMonthRow[];
  periodMode: PeriodMode;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  if (rows.length === 0) {
    return <EmptyChart message="회차별 이자 지급일 데이터가 없습니다." />;
  }

  const max = Math.max(...rows.map((r) => r.paymentCount), 1);
  const barW = Math.min(28, Math.max(10, 480 / rows.length));
  const w = Math.max(400, rows.length * (barW + 8) + 48);
  const h = 180;
  const pad = { top: 12, right: 12, bottom: 32, left: 28 };
  const innerH = h - pad.top - pad.bottom;
  const unitLabel = periodMode === "year" ? "연도별" : "월별";

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-full" role="img" aria-label="분배금 캘린더">
        {rows.map((row, i) => {
          const x = pad.left + i * (barW + 8);
          const bh = (row.paymentCount / max) * innerH;
          const selected = selectedKey === row.key;
          const hasData = row.paymentCount > 0;
          return (
            <g
              key={row.key}
              className={hasData ? "cursor-pointer" : undefined}
              onClick={() => onSelect(selected ? null : hasData ? row.key : null)}
              role={hasData ? "button" : undefined}
              aria-pressed={selected}
            >
              {selected ? (
                <rect
                  x={x - 2}
                  y={pad.top - 4}
                  width={barW + 4}
                  height={innerH + 8}
                  rx={4}
                  fill="var(--color-accent)"
                  opacity={0.08}
                />
              ) : null}
              <rect
                x={x}
                y={pad.top + innerH - bh}
                width={barW}
                height={Math.max(bh, row.paymentCount > 0 ? 2 : 0)}
                rx={3}
                fill="#00c7a9"
                opacity={selected || !selectedKey ? 1 : 0.45}
              />
              {row.paymentCount > 0 ? (
                <text
                  x={x + barW / 2}
                  y={pad.top + innerH - bh - 4}
                  textAnchor="middle"
                  className="fill-foreground text-[8px] font-medium"
                >
                  {row.paymentCount}
                </text>
              ) : null}
              <text
                x={x + barW / 2}
                y={h - 8}
                textAnchor="middle"
                className={cn("text-[8px]", selected ? "fill-foreground font-medium" : "fill-muted")}
              >
                {row.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-muted">
        {unitLabel} 이자 지급 회차 수 (총 {rows.reduce((s, r) => s + r.paymentCount, 0)}건) · 막대를 클릭하면 상세
        목록이 표시됩니다.
      </p>
    </div>
  );
}

/** 수수료액 vs 가중평균 수수료율 이중 막대 */
function FeeTrendChart({
  rows,
  selectedKey,
  onSelect,
}: {
  rows: PeriodFeeRow[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  if (rows.length === 0) {
    return <EmptyChart message="설정일·수수료율 데이터가 없습니다." />;
  }

  const maxAmount = Math.max(...rows.map((r) => r.feeAmount), 1);
  const maxRate = Math.max(...rows.map((r) => r.weightedFeeRate), 0.1);
  const barW = Math.min(28, Math.max(8, 480 / rows.length / 2.5));
  const gap = 4;
  const groupW = barW * 2 + gap;
  const w = Math.max(400, rows.length * (groupW + 12) + 56);
  const h = 210;
  const pad = { top: 16, right: 36, bottom: 36, left: 44 };
  const innerH = h - pad.top - pad.bottom;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="min-w-full" role="img" aria-label="수수료 추이">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad.top + innerH * (1 - t);
          const val = amountToEok(maxAmount * t);
          const rateVal = maxRate * t;
          return (
            <g key={t}>
              <line
                x1={pad.left}
                y1={y}
                x2={w - pad.right}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
              <text x={pad.left - 6} y={y + 4} textAnchor="end" className="fill-muted text-[9px]">
                {val >= 1 ? `${val.toFixed(0)}억` : `${(val * 10).toFixed(0)}천만`}
              </text>
              <text x={w - pad.right + 6} y={y + 4} textAnchor="start" className="fill-muted text-[9px]">
                {rateVal.toFixed(1)}%
              </text>
            </g>
          );
        })}
        {rows.map((row, i) => {
          const x0 = pad.left + i * (groupW + 12);
          const feeH = (row.feeAmount / maxAmount) * innerH;
          const rateH = (row.weightedFeeRate / maxRate) * innerH;
          const selected = selectedKey === row.key;
          const hasData = row.feeAmount > 0 || row.weightedFeeRate > 0;
          return (
            <g
              key={row.key}
              className={hasData ? "cursor-pointer" : undefined}
              onClick={() => onSelect(selected ? null : hasData ? row.key : null)}
              role={hasData ? "button" : undefined}
              aria-pressed={selected}
            >
              {selected ? (
                <rect
                  x={x0 - 2}
                  y={pad.top - 4}
                  width={groupW + 4}
                  height={innerH + 8}
                  rx={4}
                  fill="var(--color-accent)"
                  opacity={0.08}
                />
              ) : null}
              <rect
                x={x0}
                y={pad.top + innerH - feeH}
                width={barW}
                height={Math.max(feeH, row.feeAmount > 0 ? 2 : 0)}
                rx={3}
                fill="#00c7a9"
                opacity={selected || !selectedKey ? 1 : 0.45}
              />
              <rect
                x={x0 + barW + gap}
                y={pad.top + innerH - rateH}
                width={barW}
                height={Math.max(rateH, row.weightedFeeRate > 0 ? 2 : 0)}
                rx={3}
                fill="#e2f15e"
                opacity={selected || !selectedKey ? 1 : 0.45}
              />
              {row.weightedFeeRate > 0 ? (
                <text
                  x={x0 + barW + gap + barW / 2}
                  y={pad.top + innerH - rateH - 4}
                  textAnchor="middle"
                  className="fill-foreground text-[8px] font-medium"
                >
                  {row.weightedFeeRate.toFixed(1)}%
                </text>
              ) : null}
              <text
                x={x0 + groupW / 2}
                y={h - 10}
                textAnchor="middle"
                className={cn("text-[9px]", selected ? "fill-foreground font-medium" : "fill-muted")}
              >
                {row.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-im-mint" /> 수수료액
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-im-lime" /> 가중평균 수수료율
        </span>
        <span className="text-muted/80">막대를 클릭하면 상세 목록이 표시됩니다.</span>
      </div>
    </div>
  );
}

export function SetupRepaymentPanel({ funds }: { funds: LabFund[] }) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [year, setYear] = useState<string | null>(CURRENT_YEAR);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const allRows = useMemo(
    () => aggregateSetupRepayment(funds, periodMode),
    [funds, periodMode]
  );
  const years = useMemo(() => yearsFromPeriodKeys(allRows), [allRows]);
  const rows = usePeriodView(allRows, periodMode, year, fillMonthlyGaps);
  const selectedRow = rows.find((r) => r.key === selectedKey) ?? null;
  const details = useMemo(
    () =>
      selectedKey
        ? listSetupRepaymentDetails(funds, selectedKey, periodMode)
        : { setup: [], repayment: [] },
    [funds, selectedKey, periodMode]
  );

  return (
    <ChartCard
      title="설정액 · 상환액 추이"
      subtitle="설정일 기준 설정액, 상환일 기준 상환액(설정액)"
      action={
        <PeriodChartControls
          mode={periodMode}
          onModeChange={(mode) => {
            setPeriodMode(mode);
            setSelectedKey(null);
            setYear(mode === "month" ? CURRENT_YEAR : null);
          }}
          years={years}
          year={year}
          onYearChange={(y) => {
            setYear(y);
            setSelectedKey(null);
          }}
        />
      }
    >
      <SetupRepaymentChart
        rows={rows}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />
      {selectedRow ? (
        <ChartDrillDown
          title={selectedRow.label}
          summary={
            <>
              설정액 {formatEokText(selectedRow.setup)} ({details.setup.length}건) · 상환액{" "}
              {formatEokText(selectedRow.repayment)} ({details.repayment.length}건)
            </>
          }
        >
          {details.setup.length > 0 ? (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-foreground">설정 ({details.setup.length}건)</p>
              <DrillDownList items={details.setup} funds={funds} />
            </div>
          ) : null}
          {details.repayment.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-foreground">
                상환 ({details.repayment.length}건)
              </p>
              <DrillDownList items={details.repayment} funds={funds} />
            </div>
          ) : null}
          {details.setup.length === 0 && details.repayment.length === 0 ? (
            <p className="text-sm text-muted">해당 기간 데이터가 없습니다.</p>
          ) : null}
        </ChartDrillDown>
      ) : null}
    </ChartCard>
  );
}

export function FeeTrendPanel({ funds }: { funds: LabFund[] }) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [year, setYear] = useState<string | null>(CURRENT_YEAR);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const allRows = useMemo(() => aggregateFeeByPeriod(funds, periodMode), [funds, periodMode]);
  const years = useMemo(() => yearsFromPeriodKeys(allRows), [allRows]);
  const rows = usePeriodView(allRows, periodMode, year, fillMonthlyFeeGaps);
  const selectedRow = rows.find((r) => r.key === selectedKey) ?? null;
  const details = useMemo(
    () => (selectedKey ? listFeeDetails(funds, selectedKey, periodMode) : []),
    [funds, selectedKey, periodMode]
  );

  return (
    <ChartCard
      title="수수료율 · 수수료 추이"
      subtitle="설정일 기준, 수수료 = 설정액 × 수수료율(%)"
      action={
        <PeriodChartControls
          mode={periodMode}
          onModeChange={(mode) => {
            setPeriodMode(mode);
            setSelectedKey(null);
            setYear(mode === "month" ? CURRENT_YEAR : null);
          }}
          years={years}
          year={year}
          onYearChange={(y) => {
            setYear(y);
            setSelectedKey(null);
          }}
        />
      }
    >
      <FeeTrendChart rows={rows} selectedKey={selectedKey} onSelect={setSelectedKey} />
      {selectedRow ? (
        <ChartDrillDown
          title={selectedRow.label}
          summary={
            <>
              수수료액 {formatEokText(selectedRow.feeAmount)} ({selectedRow.count}건) · 가중평균
              수수료율 {selectedRow.weightedFeeRate.toFixed(2)}%
            </>
          }
        >
          <DrillDownList items={details} funds={funds} />
        </ChartDrillDown>
      ) : null}
    </ChartCard>
  );
}

export function EntityRankPanel({ funds }: { funds: LabFund[] }) {
  const [entityTab, setEntityTab] = useState<EntityTab>("trustCompany");
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const rows = useMemo(
    () => aggregateByEntity(funds, entityTab),
    [funds, entityTab]
  );
  const selectedRow = rows.find((r) => r.label === selectedLabel) ?? null;
  const details = useMemo(
    () =>
      selectedLabel ? listEntityDetails(funds, entityTab, selectedLabel) : [],
    [funds, entityTab, selectedLabel]
  );
  const tabLabel = ENTITY_TABS.find((t) => t.id === entityTab)?.label ?? "";

  return (
    <ChartCard
      title="업체별 설정액 · 건수"
      subtitle="상위 12개"
      action={
        <div className="flex flex-wrap gap-1">
          {ENTITY_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setEntityTab(t.id);
                setSelectedLabel(null);
              }}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                entityTab === t.id
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      <HorizontalRankChart
        rows={rows}
        valueLabel="설정액"
        selectedLabel={selectedLabel}
        onSelect={setSelectedLabel}
      />
      {selectedRow ? (
        <ChartDrillDown
          title={`${tabLabel} · ${selectedRow.label}`}
          summary={
            <>
              설정액 {formatCurrency(selectedRow.amount)} · {selectedRow.count}건
            </>
          }
        >
          <DrillDownList items={details} funds={funds} />
        </ChartDrillDown>
      ) : null}
    </ChartCard>
  );
}

export function RegionRankPanel({ funds }: { funds: LabFund[] }) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const rows = useMemo(() => aggregateByRegion(funds), [funds]);
  const selectedRow = rows.find((r) => r.label === selectedLabel) ?? null;
  const details = useMemo(
    () => (selectedLabel ? listRegionDetails(funds, selectedLabel) : []),
    [funds, selectedLabel]
  );

  return (
    <ChartCard title="지역별 설정액 · 건수" subtitle="사업장 주소 시·구 기준 상위 12">
      <HorizontalRankChart
        rows={rows}
        valueLabel="설정액"
        selectedLabel={selectedLabel}
        onSelect={setSelectedLabel}
      />
      {selectedRow ? (
        <ChartDrillDown
          title={selectedRow.label}
          summary={
            <>
              설정액 {formatCurrency(selectedRow.amount)} · {selectedRow.count}건
            </>
          }
        >
          <DrillDownList items={details} funds={funds} />
        </ChartDrillDown>
      ) : null}
    </ChartCard>
  );
}

export function MaturitySchedulePanel({ funds }: { funds: LabFund[] }) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [year, setYear] = useState<string | null>(CURRENT_YEAR);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showEarly, setShowEarly] = useState(true);
  const [showLoan, setShowLoan] = useState(true);
  const [showFund, setShowFund] = useState(true);
  const allRows = useMemo(
    () => aggregateMaturityByPeriod(funds, periodMode),
    [funds, periodMode]
  );
  const years = useMemo(() => yearsFromPeriodKeys(allRows), [allRows]);
  const rows = usePeriodView(allRows, periodMode, year, fillMaturityMonthlyGaps);
  const selectedRow = rows.find((r) => r.key === selectedKey) ?? null;
  const details = useMemo(
    () =>
      selectedKey
        ? listMaturityDetails(funds, selectedKey, periodMode)
        : { early: [], loan: [], fund: [] },
    [funds, selectedKey, periodMode]
  );

  const kindToggle = (
    <div className="flex flex-wrap items-center gap-1 rounded-lg bg-neutral-100 p-1">
      {(
        [
          ["early", "중도상환", showEarly, setShowEarly, "#f59e0b"],
          ["loan", "대출만기", showLoan, setShowLoan, "#7db5ff"],
          ["fund", "펀드만기", showFund, setShowFund, "#53e1e5"],
        ] as const
      ).map(([id, label, active, setActive, color]) => (
        <button
          key={id}
          type="button"
          onClick={() => setActive(!active)}
          className={cn(
            "flex flex-col items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
            active
              ? "bg-white text-foreground shadow-sm"
              : "text-muted opacity-50 hover:text-foreground hover:opacity-80"
          )}
        >
          <span
            className="h-1.5 w-6 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <ChartCard
      title="중도상환 · 대출만기 · 펀드만기 캘린더"
      subtitle={
        periodMode === "year"
          ? "연도별 만기·상환 예정 금액 (막대 위 숫자=건수)"
          : "월별 만기·상환 예정 금액 (막대 위 숫자=건수)"
      }
      action={
        <div className="flex flex-wrap items-center gap-2">
          {kindToggle}
          <PeriodChartControls
            mode={periodMode}
            onModeChange={(mode) => {
              setPeriodMode(mode);
              setSelectedKey(null);
              setYear(mode === "month" ? CURRENT_YEAR : null);
            }}
            years={years}
            year={year}
            onYearChange={(y) => {
              setYear(y);
              setSelectedKey(null);
            }}
          />
        </div>
      }
    >
      <MaturityTimelineChart
        rows={rows}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        showEarly={showEarly}
        showLoan={showLoan}
        showFund={showFund}
      />
      {selectedRow ? (
        <ChartDrillDown
          title={selectedRow.label}
          summary={
            <>
              중도상환 {selectedRow.earlyCount}건 ({formatEokText(selectedRow.earlyAmount)}) · 대출만기{" "}
              {selectedRow.loanCount}건 ({formatEokText(selectedRow.loanAmount)}) · 펀드만기{" "}
              {selectedRow.fundCount}건 ({formatEokText(selectedRow.fundAmount)})
            </>
          }
        >
          {showEarly && details.early.length > 0 ? (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-foreground">
                중도상환 ({details.early.length}건)
              </p>
              <DrillDownList items={details.early} funds={funds} />
            </div>
          ) : null}
          {showLoan && details.loan.length > 0 ? (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-foreground">
                대출만기 ({details.loan.length}건)
              </p>
              <DrillDownList items={details.loan} funds={funds} />
            </div>
          ) : null}
          {showFund && details.fund.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-foreground">
                펀드만기 ({details.fund.length}건)
              </p>
              <DrillDownList items={details.fund} funds={funds} />
            </div>
          ) : null}
          {(showEarly ? details.early.length : 0) +
            (showLoan ? details.loan.length : 0) +
            (showFund ? details.fund.length : 0) ===
          0 ? (
            <p className="text-sm text-muted">해당 기간 데이터가 없습니다.</p>
          ) : null}
        </ChartDrillDown>
      ) : null}
    </ChartCard>
  );
}

export function InterestSchedulePanel({ funds }: { funds: LabFund[] }) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [year, setYear] = useState<string | null>(CURRENT_YEAR);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const allRows = useMemo(
    () => aggregateInterestByPeriod(funds, periodMode),
    [funds, periodMode]
  );
  const years = useMemo(() => yearsFromPeriodKeys(allRows), [allRows]);
  const rows = usePeriodView(allRows, periodMode, year, fillInterestMonthlyGaps);
  const selectedRow = rows.find((r) => r.key === selectedKey) ?? null;
  const details = useMemo(
    () => (selectedKey ? listInterestDetails(funds, selectedKey, periodMode) : []),
    [funds, selectedKey, periodMode]
  );

  return (
    <ChartCard
      title="분배금 캘린더"
      subtitle={
        periodMode === "year" ? "회차별 지급일 연도별 집계" : "회차별 지급일 월별 집계"
      }
      action={
        <PeriodChartControls
          mode={periodMode}
          onModeChange={(mode) => {
            setPeriodMode(mode);
            setSelectedKey(null);
            setYear(mode === "month" ? CURRENT_YEAR : null);
          }}
          years={years}
          year={year}
          onYearChange={(y) => {
            setYear(y);
            setSelectedKey(null);
          }}
        />
      }
    >
      <InterestScheduleChart
        rows={rows}
        periodMode={periodMode}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />
      {selectedRow ? (
        <ChartDrillDown
          title={selectedRow.label}
          summary={<>이자 지급 {selectedRow.paymentCount}건</>}
        >
          <DrillDownList items={details} funds={funds} />
        </ChartDrillDown>
      ) : null}
    </ChartCard>
  );
}
