"use client";

import { useEffect, useState } from "react";
import type { LabFund } from "@/lib/types";
import { formatRate, isRepaidFund } from "@/lib/lab/portfolio-ui";
import { formatCurrency, cn } from "@/lib/utils";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { FundStatusBadge } from "@/components/ui/fund-status-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/use-auth";

function statusBadge(status: LabFund["status"]) {
  return <FundStatusBadge status={status} />;
}

function isUpcoming(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
}

/** 공정율 또는 상환완료 표시 */
export function FundProgressBadge({
  fund,
  variant = "inline",
}: {
  fund: Pick<LabFund, "actualProgressPct" | "repaymentDate" | "status">;
  variant?: "inline" | "header";
}) {
  const repaid = isRepaidFund(fund);
  const pct =
    fund.actualProgressPct != null ? `${Math.round(fund.actualProgressPct)}%` : "—";

  const repaidLabel = (
    <span className="font-extrabold tracking-tight text-im-gray">상환완료</span>
  );

  if (variant === "header") {
    return (
      <div
        className={cn(
          "flex shrink-0 flex-col items-center justify-center rounded-md border px-2",
          repaid
            ? "h-16 min-w-[5.5rem] border-im-lime bg-im-lime/45"
            : "h-16 w-16 border-im-mint/40 bg-gradient-to-br from-im-mint/10 to-white"
        )}
      >
        <span
          className={cn(
            "text-xs font-medium leading-none",
            repaid ? "font-semibold text-im-gray" : "text-im-mint"
          )}
        >
          {repaid ? "완료" : "공정율"}
        </span>
        <span
          className={cn(
            "mt-1.5 text-center leading-tight",
            repaid ? "text-sm" : "text-base font-semibold tabular-nums leading-none text-foreground"
          )}
        >
          {repaid ? repaidLabel : pct}
        </span>
      </div>
    );
  }

  if (repaid) {
    return (
      <span className="inline-flex items-center rounded-md border border-im-lime bg-im-lime/45 px-2.5 py-1 text-sm font-bold tracking-tight text-im-gray shadow-sm">
        상환완료
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-md border border-im-light-blue/50 bg-im-light-blue/15 px-2 py-1 text-sm font-semibold tabular-nums text-[#0d7a7d]">
      {pct}
    </span>
  );
}

/** 부동산랩 × 회차 가로 보드 */
export function LabRoundBoard({ funds }: { funds: LabFund[] }) {
  const maxRound = Math.max(
    0,
    ...funds.flatMap((f) => f.interestPayments.map((p) => p.round))
  );
  const rounds = Array.from({ length: Math.max(maxRound, 1) }, (_, i) => i + 1);

  if (funds.length === 0) {
    return <p className="text-sm text-muted">표시할 부동산랩이 없습니다.</p>;
  }

  return (
    <div className="shadow-card overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">부동산랩 회차별 현황</h3>
        <p className="text-xs text-muted">랩별 이자 지급 회차를 한눈에 봅니다.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-100 text-xs text-muted">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-100 px-4 py-3 font-medium">부동산랩</th>
              <th className="px-3 py-3 font-medium">사업장</th>
              <th className="px-3 py-3 font-medium">상태</th>
              <th className="min-w-[120px] px-3 py-3 font-medium text-sky-800">
                공정율
              </th>
              {rounds.map((r) => (
                <th key={r} className="px-3 py-3 text-center font-medium whitespace-nowrap">
                  {r}회차
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {funds.map((fund) => {
              const byRound = new Map(fund.interestPayments.map((p) => [p.round, p]));
              return (
                <tr key={fund.id} id={fund.id} className="hover:bg-slate-100/80">
                  <td className="sticky left-0 z-10 bg-card px-4 py-3">
                    <p className="font-semibold">{fund.name}</p>
                    <p className="text-xs text-muted">
                      {[fund.fundName, fund.fundCode].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </td>
                  <td className="max-w-[180px] px-3 py-3">
                    <p className="truncate text-sm">{fund.siteAddress ?? "미기재"}</p>
                  </td>
                  <td className="px-3 py-3">{statusBadge(fund.status)}</td>
                  <td className="px-3 py-3">
                    <FundProgressBadge fund={fund} />
                  </td>
                  {rounds.map((r) => {
                    const p = byRound.get(r);
                    const upcoming = p ? isUpcoming(p.date) : false;
                    return (
                      <td
                        key={r}
                        className={cn(
                          "px-3 py-3 text-center text-xs tabular-nums whitespace-nowrap",
                          upcoming ? "font-medium text-accent" : "text-muted"
                        )}
                      >
                        {p ? p.raw ?? p.date : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 사업장/회차별과 동일한 상세 패널 (툴팁·카드 공용) */
export function LabRoundDetail({
  fund,
  embedded = false,
  readOnly = false,
  compact = false,
  onFundUpdated,
}: {
  fund: LabFund;
  embedded?: boolean;
  /** true면 진행현황 코멘트 조회만 */
  readOnly?: boolean;
  /** 툴팁 등 좁은 영역용 */
  compact?: boolean;
  onFundUpdated?: (fund: LabFund) => void;
}) {
  const { isAdmin } = useAuth();
  const canEdit = isAdmin && !readOnly;
  const payments = [...fund.interestPayments].sort((a, b) => a.round - b.round);
  const [comment, setComment] = useState(fund.progressComment ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    setComment(fund.progressComment ?? "");
    setMessage(null);
  }, [fund.id, fund.progressComment]);

  async function saveComment() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/lab-portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundId: fund.id, progressComment: comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "저장 실패");
        return;
      }
      setMessage("코멘트가 저장되었습니다.");
      onFundUpdated?.(data.fund);
    } finally {
      setSaving(false);
    }
  }

  const v = (x: string | null | undefined) => x?.trim() || "—";
  const conditions: { label: string; value: string | null | undefined }[] = [
    { label: "매입기관", value: v(fund.purchaseAgency) },
    {
      label: "설정액(잔액)",
      value:
        fund.setupAmount != null || fund.balance != null
          ? `${fund.setupAmount != null ? formatCurrency(fund.setupAmount) : "—"}(${fund.balance != null ? formatCurrency(fund.balance) : "—"})`
          : "—",
    },
    { label: "금리", value: formatRate(fund.interestRate) },
    { label: "수수료율", value: formatRate(fund.feeRate) },
    { label: "설정일", value: v(fund.setupDate) },
    { label: "대출만기일", value: v(fund.loanMaturityDate) },
    { label: "펀드만기일", value: v(fund.maturityDate) },
    { label: "상환일", value: v(fund.repaymentDate) },
    { label: "신탁사", value: v(fund.trustCompany) },
    { label: "신탁방식", value: v(fund.trustType) },
    { label: "시행사", value: fund.developer },
    { label: "시공사", value: fund.contractor },
    { label: "대지면적", value: fund.landArea },
    { label: "건축면적", value: fund.buildingArea },
    { label: "연면적", value: fund.totalFloorArea },
    { label: "건축규모", value: fund.buildingScale },
    { label: "세대수", value: fund.householdCount },
    { label: "비고", value: fund.note },
  ];

  const codeParts = [
    { label: "펀드명", value: fund.fundName },
    { label: "상품코드", value: fund.productCode },
    { label: "펀드코드", value: fund.fundCode },
  ].map(({ label, value }) => value?.trim() || label);
  const siteAddress = fund.siteAddress?.trim();
  const businessDesc = fund.businessDesc?.trim() || "사업내용";
  const hasMap = Boolean(siteAddress);
  const mapUrl = siteAddress
    ? `https://www.google.com/maps?q=${encodeURIComponent(siteAddress)}&output=embed`
    : "";

  return (
    <article
      id={embedded ? undefined : fund.id}
      className={cn(
        "overflow-hidden bg-card",
        !embedded && "shadow-card rounded-xl border border-border"
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-3 border-b border-border bg-white",
          compact ? "px-3 py-3" : "px-5 py-4"
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h3
                className={cn(
                  "font-semibold text-slate-900",
                  compact ? "text-base" : "text-lg"
                )}
              >
                {fund.name}
              </h3>
              <span className="text-xs text-slate-500">{codeParts.join(" / ")}</span>
            </div>
            <p className="mt-1 text-sm text-slate-700 break-words">
              {hasMap ? (
                <button
                  type="button"
                  onClick={() => setMapOpen(true)}
                  className="font-medium text-link underline decoration-dotted underline-offset-2"
                  title="지도에서 주소 보기"
                >
                  {siteAddress}
                </button>
              ) : (
                siteAddress || "사업장 주소"
              )}
              {" / "}
              {businessDesc}
            </p>
          </div>
          <FundProgressBadge fund={fund} variant="header" />
        </div>
        {statusBadge(fund.status)}
      </div>

      <div className={cn("space-y-5", compact ? "p-3" : "p-5")}>
        <div>
          <h4 className="mb-3 text-sm font-semibold text-slate-800">투자 주요 조건</h4>
          <HorizontalScroll>
            <dl className="grid w-max min-w-full grid-cols-4 gap-3">
              {conditions.map((item) => (
                <Item key={item.label} label={item.label} value={item.value} />
              ))}
            </dl>
          </HorizontalScroll>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800">회차별 이자지급</h4>
            <span className="text-xs text-muted">{payments.length}회차</span>
          </div>
          {payments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-neutral-50 px-3 py-4 text-center text-xs text-muted">
              등록된 회차가 없습니다.
            </p>
          ) : (
            <HorizontalScroll>
              <ol className="grid w-max grid-cols-4 gap-2">
              {payments.map((p) => {
                const upcoming = isUpcoming(p.date);
                return (
                  <li
                    key={`${fund.id}-${p.round}`}
                    className={cn(
                      "w-36 shrink-0 rounded-lg border px-3 py-3",
                      upcoming ? "border-accent/30 bg-blue-50/60" : "border-border bg-neutral-50"
                    )}
                  >
                    <p className="text-xs font-medium text-muted">{p.round}회차</p>
                    <p
                      className={cn(
                        "mt-1 text-sm tabular-nums",
                        upcoming ? "font-semibold text-[#0d7a7d]" : "text-slate-700"
                      )}
                    >
                      {p.raw ?? p.date}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">{upcoming ? "예정" : "경과"}</p>
                  </li>
                );
              })}
              </ol>
            </HorizontalScroll>
          )}
        </div>

        <section className="rounded-lg border border-border bg-neutral-50/70 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800">진행현황 코멘트</h4>
            {canEdit ? (
              <span className="text-[11px] text-muted">관리자 편집</span>
            ) : (
              <span className="text-[11px] text-muted">조회 전용</span>
            )}
          </div>

          {canEdit ? (
            <div className="space-y-2">
              <textarea
                className="min-h-[6rem] w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="공사 진행 상황, 이슈, 다음 액션 등을 입력하세요."
              />
              <div className="flex items-center gap-2">
                <Button type="button" onClick={saveComment} disabled={saving}>
                  {saving ? "저장 중…" : "코멘트 저장"}
                </Button>
                {message ? <p className="text-xs text-muted">{message}</p> : null}
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {fund.progressComment?.trim()
                ? fund.progressComment
                : "등록된 진행현황 코멘트가 없습니다."}
            </p>
          )}
        </section>
      </div>
      {mapOpen && siteAddress ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${fund.name} 사업장 지도`}
          onClick={() => setMapOpen(false)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{fund.name} 사업장</p>
                <p className="truncate text-xs text-muted">{siteAddress}</p>
              </div>
              <button
                type="button"
                onClick={() => setMapOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xl text-muted hover:bg-slate-100 hover:text-foreground"
                aria-label="지도 닫기"
              >
                ×
              </button>
            </div>
            <iframe
              title={`${fund.name} 사업장 지도`}
              src={mapUrl}
              className="h-[min(65vh,520px)] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}

/** 부동산랩 1건 · 회차 카드 */
export function LabRoundCard({
  fund,
  embedded = false,
  onFundUpdated,
}: {
  fund: LabFund;
  embedded?: boolean;
  onFundUpdated?: (fund: LabFund) => void;
}) {
  return (
    <LabRoundDetail fund={fund} embedded={embedded} onFundUpdated={onFundUpdated} />
  );
}

function splitDisplayLines(raw: string | null | undefined): string[] {
  const s = raw?.trim();
  if (!s) return ["—"];
  const lines = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines : ["—"];
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  const lines = splitDisplayLines(value);
  return (
    <div className="min-w-[9rem]">
      <dt className="text-[11px] font-medium text-[#0d7a7d]">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-700 tabular-nums">
        {lines.length === 1 ? (
          <span className="break-words">{lines[0]}</span>
        ) : (
          <div className="flex flex-col gap-1">
            {lines.map((line, i) => (
              <span key={i} className="block break-words leading-snug">
                {line}
              </span>
            ))}
          </div>
        )}
      </dd>
    </div>
  );
}
