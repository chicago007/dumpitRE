import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { fetchSiteDetail } from "@/lib/data/repository";
import { formatCurrency, formatMonthLabel, isDelayed, statusLabel } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function SiteDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab = "progress" } = await searchParams;
  const site = await fetchSiteDetail(id);
  if (!site) notFound();

  const delayed = isDelayed(site);
  const latest = site.progressReports[0];
  const latestFund = site.fundSchedules[0];

  const tabs = [
    { id: "overview", label: "개요" },
    { id: "progress", label: "공정율" },
    { id: "funds", label: "자금" },
    { id: "documents", label: "문서" },
  ];

  return (
    <AppShell title={site.name}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{statusLabel(site.status)}</Badge>
          {site.code && <span className="text-sm text-muted">{site.code}</span>}
          {delayed && <Badge variant="warning">공정 지연</Badge>}
        </div>

        <div className="flex gap-2 border-b border-border pb-1">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/sites/${id}?tab=${t.id}`}
              className={
                tab === t.id
                  ? "rounded-md bg-foreground px-3 py-1.5 text-sm text-white"
                  : "rounded-md px-3 py-1.5 text-sm text-muted hover:bg-neutral-100"
              }
            >
              {t.label}
            </Link>
          ))}
          <Link
            href="/chat"
            className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-neutral-100"
          >
            Q&A
          </Link>
        </div>

        {tab === "overview" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">사업장 정보</h3>
              </CardHeader>
              <CardBody className="space-y-2 text-sm">
                <Row label="주소" value={site.address} />
                <Row label="시공사" value={site.contractor ?? "-"} />
                <Row label="CM" value={site.cmCompany ?? "-"} />
                <Row label="계약금액" value={site.contractAmount ? formatCurrency(site.contractAmount) : "-"} />
                <Row label="공사기간" value={`${site.startDate ?? "-"} ~ ${site.endDate ?? "-"}`} />
              </CardBody>
            </Card>
            {latest && (
              <Card>
                <CardHeader>
                  <h3 className="text-sm font-semibold">최신 공정 ({formatMonthLabel(latest.reportMonth)})</h3>
                </CardHeader>
                <CardBody>
                  <ProgressBar value={latest.overallProgressPct} label="실적" tone={delayed ? "red" : "blue"} />
                  <div className="mt-2">
                    <ProgressBar value={latest.plannedProgressPct} label="계획" tone="amber" />
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        )}

        {tab === "progress" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {site.progressReports.map((pr) => (
                <Card key={pr.id}>
                  <CardHeader>
                    <h3 className="text-sm font-semibold">{formatMonthLabel(pr.reportMonth)}</h3>
                  </CardHeader>
                  <CardBody>
                    <div className="mb-4 flex gap-6 text-sm">
                      <span>실적 <strong>{pr.overallProgressPct}%</strong></span>
                      <span className="text-muted">계획 {pr.plannedProgressPct}%</span>
                      <span className={pr.overallProgressPct < pr.plannedProgressPct ? "text-warning" : "text-success"}>
                        차이 {(pr.overallProgressPct - pr.plannedProgressPct).toFixed(1)}%p
                      </span>
                    </div>
                    <div className="space-y-2">
                      {pr.details.map((d) => (
                        <ProgressBar key={d.trade} value={d.actual} label={`${d.trade} (계획 ${d.planned}%)`} />
                      ))}
                    </div>
                  </CardBody>
                </Card>
              ))}
              {site.progressReports.length === 0 && (
                <p className="text-sm text-muted">공정율 보고서가 없습니다.</p>
              )}
            </div>
            {latestFund && latest && latestFund.actualAmount != null && (
              <Card className="h-fit border-amber-200 bg-amber-50/50">
                <CardBody>
                  <h4 className="text-sm font-semibold text-warning">S-curve 이탈</h4>
                  <p className="mt-2 text-sm text-muted">
                    {formatMonthLabel(latest.reportMonth)} 집행률(
                    {Math.round((latestFund.actualAmount / latestFund.plannedAmount) * 100)}%)이
                    공정율({latest.overallProgressPct}%) 대비 낮을 수 있습니다.
                  </p>
                </CardBody>
              </Card>
            )}
          </div>
        )}

        {tab === "funds" && (
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">월별 자금집행</h3>
            </CardHeader>
            <CardBody className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="pb-2 pr-4">월</th>
                    <th className="pb-2 pr-4">계획</th>
                    <th className="pb-2 pr-4">실적</th>
                    <th className="pb-2">집행률</th>
                  </tr>
                </thead>
                <tbody>
                  {site.fundSchedules.map((f) => (
                    <tr key={f.id} className="border-b border-border">
                      <td className="py-2 pr-4">{f.scheduleMonth.slice(0, 7)}</td>
                      <td className="py-2 pr-4">{formatCurrency(f.plannedAmount)}</td>
                      <td className="py-2 pr-4">{f.actualAmount ? formatCurrency(f.actualAmount) : "-"}</td>
                      <td className="py-2">
                        {f.actualAmount
                          ? `${Math.round((f.actualAmount / f.plannedAmount) * 100)}%`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {site.fundSchedules.length === 0 && (
                <p className="text-sm text-muted">자금집행 데이터가 없습니다.</p>
              )}
            </CardBody>
          </Card>
        )}

        {tab === "documents" && (
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold">업로드 문서</h3>
            </CardHeader>
            <CardBody className="divide-y divide-border">
              {site.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{doc.fileName}</p>
                    <p className="text-xs text-muted">{doc.type}</p>
                  </div>
                  <Badge variant={doc.analysisStatus === "done" ? "success" : "default"}>
                    {doc.analysisStatus}
                  </Badge>
                </div>
              ))}
              {site.documents.length === 0 && (
                <p className="text-sm text-muted">문서가 없습니다.</p>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
