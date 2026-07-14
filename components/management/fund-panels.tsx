import type { LabFund } from "@/lib/types";
import { formatRate, progressLabel } from "@/lib/lab/portfolio-ui";
import { formatCurrency, cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";

function statusBadge(status: LabFund["status"]) {
  if (status === "active") return <Badge variant="success">운용중</Badge>;
  if (status === "repaid") return <Badge variant="default">상환완료</Badge>;
  return <Badge>미확인</Badge>;
}

function isUpcoming(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
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
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">부동산랩 회차별 현황</h3>
        <p className="text-xs text-muted">랩별 이자 지급 회차를 한눈에 봅니다.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-neutral-50 text-xs text-muted">
            <tr>
              <th className="sticky left-0 z-10 bg-neutral-50 px-4 py-3 font-medium">부동산랩</th>
              <th className="px-3 py-3 font-medium">사업장</th>
              <th className="px-3 py-3 font-medium">상태</th>
              <th className="min-w-[120px] px-3 py-3 font-medium">공정율</th>
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
                <tr key={fund.id} id={fund.id} className="hover:bg-neutral-50/90">
                  <td className="sticky left-0 z-10 bg-card px-4 py-3">
                    <p className="font-semibold">{fund.name}</p>
                    <p className="text-xs text-muted">
                      {[fund.fundName, fund.fundCode].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </td>
                  <td className="max-w-[180px] px-3 py-3">
                    <p className="truncate text-sm">{fund.siteAddress ?? "미기재"}</p>
                    <p className="truncate text-xs text-muted">{fund.businessDesc}</p>
                  </td>
                  <td className="px-3 py-3">{statusBadge(fund.status)}</td>
                  <td className="px-3 py-3">
                    <p className="text-[11px] text-muted">
                      실행 {progressLabel(fund.actualProgressPct)}
                    </p>
                    <ProgressBar value={fund.actualProgressPct} tone="green" />
                  </td>
                  {rounds.map((r) => {
                    const p = byRound.get(r);
                    const upcoming = p ? isUpcoming(p.date) : false;
                    return (
                      <td key={r} className="px-3 py-3 text-center whitespace-nowrap">
                        {p ? (
                          <span
                            className={cn(
                              "inline-flex rounded-md px-2 py-1 text-xs tabular-nums",
                              upcoming
                                ? "bg-blue-50 font-medium text-accent"
                                : "bg-neutral-100 text-muted"
                            )}
                          >
                            {p.raw ?? p.date}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
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

/** 부동산랩 1건 · 회차 카드 */
export function LabRoundCard({ fund }: { fund: LabFund }) {
  const payments = [...fund.interestPayments].sort((a, b) => a.round - b.round);

  return (
    <article id={fund.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-neutral-50 px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold">{fund.name}</h3>
          <p className="mt-1 text-sm text-muted">
            {fund.siteAddress ?? "사업장 미기재"}
            {fund.businessDesc ? ` · ${fund.businessDesc}` : ""}
          </p>
        </div>
        {statusBadge(fund.status)}
      </div>

      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <ProgressBar label="실행 공정율" value={fund.actualProgressPct} tone="green" size="md" />
          <ProgressBar label="계획 공정율" value={fund.plannedProgressPct} tone="blue" size="md" />
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Item label="매입약정" value={fund.purchaseAgency ?? "—"} />
          <Item label="신탁유형" value={fund.trustType ?? "—"} />
          <Item label="금리" value={formatRate(fund.interestRate)} />
          <Item
            label="설정액"
            value={fund.setupAmount != null ? formatCurrency(fund.setupAmount) : "—"}
          />
          <Item label="잔액" value={fund.balance != null ? formatCurrency(fund.balance) : "—"} />
        </dl>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold">회차별 이자지급</h4>
            <span className="text-xs text-muted">{payments.length}회차</span>
          </div>
          {payments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-neutral-50 px-3 py-4 text-center text-xs text-muted">
              등록된 회차가 없습니다.
            </p>
          ) : (
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {payments.map((p) => {
                const upcoming = isUpcoming(p.date);
                return (
                  <li
                    key={`${fund.id}-${p.round}`}
                    className={cn(
                      "rounded-lg border px-3 py-3",
                      upcoming ? "border-accent/30 bg-blue-50/60" : "border-border bg-neutral-50"
                    )}
                  >
                    <p className="text-xs font-medium text-muted">{p.round}회차</p>
                    <p
                      className={cn(
                        "mt-1 text-sm tabular-nums",
                        upcoming ? "font-semibold text-accent" : "text-foreground"
                      )}
                    >
                      {p.raw ?? p.date}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">{upcoming ? "예정" : "경과"}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </article>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm tabular-nums">{value}</dd>
    </div>
  );
}
