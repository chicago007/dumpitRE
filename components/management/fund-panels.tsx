"use client";

import { useEffect, useRef, useState } from "react";
import type { LabFund, LabProgressRow, ProgressAttachment } from "@/lib/types";
import { formatRate, hasRepaymentDate, isRepaidFund } from "@/lib/lab/portfolio-ui";
import { formatBalance, formatCurrency, cn } from "@/lib/utils";
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

function formatChartDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "미확인";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** 확인일별 계획·실적 막대 시계열 */
function ProgressHistoryBarChart({ rows }: { rows: LabProgressRow[] }) {
  const n = rows.length;
  const groupW = 56;
  const gap = 18;
  const pad = { top: 20, right: 12, bottom: 36, left: 36 };
  const barW = 14;
  const pairGap = 4;
  const chartW = Math.max(320, pad.left + pad.right + n * (groupW + gap) - gap);
  const chartH = 200;
  const innerH = chartH - pad.top - pad.bottom;
  const maxY = 100;

  const y = (v: number) => pad.top + innerH - (Math.min(maxY, Math.max(0, v)) / maxY) * innerH;
  const groupX = (i: number) => pad.left + i * (groupW + gap);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="min-w-full"
        style={{ minWidth: chartW, height: chartH }}
        role="img"
        aria-label="월별 공정율 막대그래프"
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={chartW - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e5e3da"
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={y(tick) + 3}
              textAnchor="end"
              fontSize={10}
              fill="#666666"
            >
              {tick}
            </text>
          </g>
        ))}
        {rows.map((row, i) => {
          const gx = groupX(i);
          const planned = row.plannedProgressPct;
          const actual = row.actualProgressPct;
          const plannedH =
            planned == null ? 0 : ((Math.min(maxY, Math.max(0, planned)) / maxY) * innerH);
          const actualH =
            actual == null ? 0 : ((Math.min(maxY, Math.max(0, actual)) / maxY) * innerH);
          const base = pad.top + innerH;
          const plannedX = gx + (groupW - barW * 2 - pairGap) / 2;
          const actualX = plannedX + barW + pairGap;
          return (
            <g key={row.id}>
              {planned != null ? (
                <rect
                  x={plannedX}
                  y={base - plannedH}
                  width={barW}
                  height={Math.max(plannedH, 1)}
                  rx={2}
                  fill="#cdc9b7"
                />
              ) : null}
              {actual != null ? (
                <rect
                  x={actualX}
                  y={base - actualH}
                  width={barW}
                  height={Math.max(actualH, 1)}
                  rx={2}
                  fill="#00c7a9"
                />
              ) : null}
              <text
                x={gx + groupW / 2}
                y={chartH - 18}
                textAnchor="middle"
                fontSize={10}
                fill="#666666"
              >
                {formatChartDate(row.confirmedDate)}
              </text>
              {(actual != null || planned != null) && (
                <text
                  x={gx + groupW / 2}
                  y={chartH - 6}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#00a892"
                  className="tabular-nums"
                >
                  {actual != null
                    ? `${actual.toFixed(1)}%`
                    : planned != null
                      ? `계 ${planned.toFixed(1)}%`
                      : ""}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
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
              const hidePays = hasRepaymentDate(fund);
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
                    if (hidePays) {
                      return (
                        <td key={r} className="px-3 py-3 text-center text-xs text-muted">
                          —
                        </td>
                      );
                    }
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

/** PDF 첫 페이지를 캔버스로 렌더한 실제 내용 썸네일 */
function PdfContentThumb({
  contentUrl,
  fileName,
}: {
  contentUrl: string;
  fileName: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const res = await fetch(contentUrl, { credentials: "include" });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const data = new Uint8Array(await res.arrayBuffer());
      const doc = await pdfjs.getDocument({ data }).promise;
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const target = 56 * dpr;
      // 상단 내용이 보이도록 가로 기준 fit 후 세로 crop
      const scale = target / base.width;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(Math.min(viewport.height, target));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      // 전체 페이지 렌더 후 상단만 보이도록 canvas 높이로 clip
      const fullCanvas = document.createElement("canvas");
      fullCanvas.width = Math.ceil(viewport.width);
      fullCanvas.height = Math.ceil(viewport.height);
      const fullCtx = fullCanvas.getContext("2d");
      if (!fullCtx) throw new Error("no canvas");
      await page.render({
        canvasContext: fullCtx,
        viewport,
        canvas: fullCanvas,
      }).promise;
      ctx.drawImage(
        fullCanvas,
        0,
        0,
        fullCanvas.width,
        canvas.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
      if (!cancelled) setStatus("ready");
    })().catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
    };
  }, [contentUrl]);

  if (status === "error") {
    return (
      <div className="flex h-14 w-14 flex-col items-center justify-center bg-slate-100 px-1">
        <span className="text-[10px] font-bold tracking-wide text-rose-600">PDF</span>
        <span className="line-clamp-2 w-full text-center text-[8px] leading-tight text-slate-500">
          {fileName.replace(/\.pdf$/i, "")}
        </span>
      </div>
    );
  }

  return (
    <div className="relative h-14 w-14 overflow-hidden bg-white">
      {status === "loading" ? (
        <div className="absolute inset-0 animate-pulse bg-slate-100" />
      ) : null}
      <canvas ref={canvasRef} className="h-14 w-14" aria-label={fileName} />
    </div>
  );
}

/** 진행현황 코멘트 박스 안 작은 첨부 썸네일 */
function ProgressAttachmentThumb({
  fundId,
  att,
  canEdit,
  onRemove,
}: {
  fundId: string;
  att: ProgressAttachment;
  canEdit: boolean;
  onRemove: () => void;
}) {
  const isImage = (att.mimeType || "").startsWith("image/");
  const isPdf =
    (att.mimeType || "").includes("pdf") || /\.pdf$/i.test(att.fileName);
  const contentUrl = `/api/lab-portfolio/attachments/file?fundId=${encodeURIComponent(fundId)}&attachmentId=${encodeURIComponent(att.id)}`;
  // 원본: Drive 링크가 있으면 그걸, 없으면 파일 API
  const openUrl = att.url || contentUrl;

  return (
    <div className="group relative">
      <a
        href={openUrl}
        target="_blank"
        rel="noreferrer"
        title={`${att.fileName} · 클릭하면 원본 보기`}
        className="block overflow-hidden rounded border border-border bg-neutral-50 shadow-sm transition hover:border-accent/50 hover:shadow"
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contentUrl}
            alt={att.fileName}
            className="h-14 w-14 object-cover"
          />
        ) : isPdf ? (
          <PdfContentThumb contentUrl={contentUrl} fileName={att.fileName} />
        ) : (
          <div className="flex h-14 w-14 flex-col items-center justify-center bg-slate-100 px-1">
            <span className="text-[10px] font-bold text-slate-600">FILE</span>
          </div>
        )}
      </a>
      {canEdit ? (
        <button
          type="button"
          aria-label={`${att.fileName} 삭제`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-[10px] leading-none text-white opacity-0 shadow transition group-hover:opacity-100"
        >
          ×
        </button>
      ) : null}
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
  const { isAdmin, canViewFullOverview } = useAuth();
  const canEdit = isAdmin && !readOnly;
  const payments = [...fund.interestPayments].sort((a, b) => a.round - b.round);
  const repaid = hasRepaymentDate(fund);
  const displayPayments = repaid ? [] : payments;
  const [comment, setComment] = useState(fund.progressComment ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [history, setHistory] = useState<LabProgressRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachments = fund.progressAttachments ?? [];

  useEffect(() => {
    setComment(fund.progressComment ?? "");
    setMessage(null);
  }, [fund.id, fund.progressComment]);

  useEffect(() => {
    if (!canViewFullOverview) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    fetch(
      `/api/lab-progress?history=1&labName=${encodeURIComponent(fund.name)}`,
      { cache: "no-store" }
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "이력 조회 실패");
        return data as LabProgressRow[];
      })
      .then((rows) => {
        if (!cancelled) setHistory(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canViewFullOverview, fund.name, fund.actualProgressPct, fund.plannedProgressPct]);

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

  async function uploadAttachment(file: File) {
    setUploadingFile(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("fundId", fund.id);
      form.set("file", file);
      const res = await fetch("/api/lab-portfolio/attachments", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "첨부 실패");
        return;
      }
      setMessage(
        data.warning
          ? `${file.name} 첨부됨 (${data.warning})`
          : `${file.name} 첨부됨`
      );
      onFundUpdated?.(data.fund);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeAttachment(att: ProgressAttachment) {
    if (!confirm(`${att.fileName} 첨부를 삭제할까요?`)) return;
    setMessage(null);
    const res = await fetch("/api/lab-portfolio/attachments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fundId: fund.id, attachmentId: att.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "삭제 실패");
      return;
    }
    setMessage("첨부를 삭제했습니다.");
    onFundUpdated?.(data.fund);
  }

  const chartRows = [...history]
    .filter(
      (r) =>
        r.confirmedDate ||
        r.plannedProgressPct != null ||
        r.actualProgressPct != null
    )
    .sort((a, b) =>
      (a.confirmedDate ?? "9999").localeCompare(b.confirmedDate ?? "9999")
    );

  const v = (x: string | null | undefined) => x?.trim() || "—";
  const conditions: { label: string; value: string | null | undefined }[] = [
    { label: "매입기관", value: v(fund.purchaseAgency) },
    {
      label: "설정액(잔액)",
      value:
        fund.setupAmount != null
          ? `${formatCurrency(fund.setupAmount)}(${formatBalance(fund.balance)})`
          : fund.balance != null && fund.balance > 0
            ? `-(${formatBalance(fund.balance)})`
            : "-",
    },
    { label: "금리", value: formatRate(fund.interestRate) },
    { label: "수수료율", value: formatRate(fund.feeRate) },
    { label: "설정일", value: v(fund.setupDate) },
    { label: "중도상환(예정)일", value: v(fund.earlyRepaymentDate) },
    { label: "대출만기일", value: v(fund.loanMaturityDate) },
    { label: "펀드만기일", value: v(fund.maturityDate) },
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
  const addressLines = splitSiteAddressLines(siteAddress);
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
              <span className="text-xs font-normal text-slate-500">
                {codeParts.join(" / ")}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-700 break-words">
              {!hasMap ? (
                <span>사업장 주소</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setMapOpen(true)}
                  className="font-medium text-link underline decoration-dotted underline-offset-2 text-left"
                  title="지도에서 주소 보기"
                >
                  {addressLines.map((line, i) => (
                    <span key={i} className="block leading-snug">
                      {line}
                    </span>
                  ))}
                </button>
              )}
              {" / "}
              {businessDesc}
            </p>
          </div>
          <FundProgressBadge fund={fund} variant="header" />
          {fund.repaymentDate?.trim() ? (
            <div className="flex h-16 shrink-0 flex-col justify-center">
              <span className="text-xs font-normal leading-none text-slate-500">상환일</span>
              <span className="mt-1 text-xs font-normal tabular-nums text-slate-500">
                {fund.repaymentDate.trim()}
              </span>
            </div>
          ) : null}
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
            <span className="text-xs text-muted">
              {repaid ? "상환 완료" : `${displayPayments.length}회차`}
            </span>
          </div>
          {repaid ? (
            <p className="rounded-lg border border-dashed border-border bg-neutral-50 px-3 py-4 text-center text-xs text-muted">
              상환일이 등록되어 분배 일정은 표시하지 않습니다.
            </p>
          ) : displayPayments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-neutral-50 px-3 py-4 text-center text-xs text-muted">
              등록된 회차가 없습니다.
            </p>
          ) : (
            <HorizontalScroll>
              <ol className="grid w-max grid-cols-4 gap-2">
              {displayPayments.map((p) => {
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

        {canViewFullOverview ? (
          <section className="rounded-lg border border-border bg-white p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">월별 공정율</h4>
                <p className="mt-0.5 text-[11px] text-muted">
                  확인일 기준 시계열 · 최신 값은 상단 공정율 배지에 표시
                </p>
              </div>
              <div className="flex gap-3 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-im-beige" /> 계획
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-im-mint" /> 실적
                </span>
              </div>
            </div>
            {historyLoading ? (
              <p className="text-xs text-muted">불러오는 중…</p>
            ) : chartRows.length === 0 ? (
              <p className="text-xs text-muted">등록된 공정율 이력이 없습니다.</p>
            ) : (
              <ProgressHistoryBarChart rows={chartRows} />
            )}
          </section>
        ) : null}

        <section className="rounded-lg border border-border bg-neutral-50/70 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800">진행현황 코멘트</h4>
            {canEdit ? (
              <span className="text-[11px] text-muted">관리자 편집</span>
            ) : (
              <span className="text-[11px] text-muted">조회 전용</span>
            )}
          </div>

          <div
            className={cn(
              "rounded-md border border-border bg-white",
              canEdit ? "" : "px-3 py-2"
            )}
          >
            {canEdit ? (
              <textarea
                className="min-h-[6rem] w-full resize-y rounded-t-md border-0 bg-transparent px-3 py-2 text-sm outline-none"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="공사 진행 상황, 이슈, 다음 액션 등을 입력하세요."
              />
            ) : (
              <p className="min-h-[3rem] whitespace-pre-wrap text-sm text-foreground">
                {fund.progressComment?.trim()
                  ? fund.progressComment
                  : "등록된 진행현황 코멘트가 없습니다."}
              </p>
            )}

            {attachments.length > 0 ? (
              <div
                className={cn(
                  "flex flex-wrap gap-2 px-2 pb-2",
                  canEdit && "border-t border-border/60 pt-2"
                )}
              >
                {attachments.map((att) => (
                  <ProgressAttachmentThumb
                    key={att.id}
                    fundId={fund.id}
                    att={att}
                    canEdit={canEdit}
                    onRemove={() => void removeAttachment(att)}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {canEdit ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button type="button" onClick={saveComment} disabled={saving}>
                {saving ? "저장 중…" : "코멘트 저장"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAttachment(f);
                }}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={uploadingFile}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingFile ? "첨부 중…" : "pdf·사진첨부"}
              </Button>
              {message ? <p className="text-xs text-muted">{message}</p> : null}
            </div>
          ) : message ? (
            <p className="mt-2 text-xs text-muted">{message}</p>
          ) : null}
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

/** 복수 값: 줄바꿈 또는 ", "(쉼표+공백)로 분리. 천단위 쉼표(1,291)는 유지 */
function splitDisplayLines(raw: string | null | undefined): string[] {
  const s = raw?.trim();
  if (!s || s === "—") return ["—"];
  const byNewline = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parts = byNewline.flatMap((line) =>
    line
      .split(/,\s+/)
      .map((p) => p.trim())
      .filter(Boolean)
  );
  return parts.length ? parts : ["—"];
}

/** 새 사업장 주소처럼 보이는지 (시·군·구·동 등). 필지번호 "3-204" 는 false */
function looksLikeSiteAddress(part: string): boolean {
  const t = part.trim();
  if (!t || !/[가-힣]/.test(t)) return false;
  return /(?:특별시|광역시|특별자치시|특별자치도|시|군|구|읍|면|동|리|로|길)/.test(t);
}

/**
 * 사업장 주소 전용: 서로 다른 지역만 줄바꿈.
 * "북가좌동 275-3, 3-204" 처럼 필지 연속은 한 줄로 유지.
 */
function splitSiteAddressLines(raw: string | null | undefined): string[] {
  const s = raw?.trim();
  if (!s || s === "—") return ["—"];
  const byNewline = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const merged: string[] = [];
  for (const line of byNewline) {
    const chunks = line.split(/,\s+/).map((p) => p.trim()).filter(Boolean);
    if (!chunks.length) continue;
    let current = chunks[0];
    for (let i = 1; i < chunks.length; i++) {
      const next = chunks[i];
      if (looksLikeSiteAddress(next)) {
        merged.push(current);
        current = next;
      } else {
        current = `${current}, ${next}`;
      }
    }
    merged.push(current);
  }
  return merged.length ? merged : ["—"];
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
