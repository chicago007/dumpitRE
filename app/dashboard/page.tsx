import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { ProgressChart } from "@/components/dashboard/progress-chart";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  fetchAttentionSites,
  fetchDashboardStats,
  fetchDocuments,
  fetchPortfolioProgress,
} from "@/lib/data/repository";
import { formatMonthLabel } from "@/lib/utils";

export default async function DashboardPage() {
  const [stats, portfolio, attention, documents] = await Promise.all([
    fetchDashboardStats(),
    fetchPortfolioProgress(),
    fetchAttentionSites(),
    fetchDocuments(),
  ]);

  return (
    <AppShell title="대시보드">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard value={stats.inProgressCount} label="진행 중 사업장" tone="info" />
          <StatCard value={`${stats.avgProgressPct}%`} label="포트폴리오 평균 공정율" />
          <StatCard value={stats.delayedCount} label="지연 사업장" tone="warning" />
          <StatCard value={`${stats.monthlyFundPct}%`} label="당월 자금 집행률" tone="success" />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ProgressChart data={portfolio} />
          </div>
          <div className="lg:col-span-2 rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">주의 필요 사업장</h3>
            </div>
            <div className="divide-y divide-border">
              {attention.length === 0 ? (
                <p className="p-4 text-sm text-muted">현재 주의 사업장이 없습니다.</p>
              ) : (
                attention.map((site) => (
                  <Link
                    key={site.id}
                    href={`/sites/${site.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
                  >
                    <span className="text-sm font-medium">{site.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm tabular-nums">{site.latestProgressPct}%</span>
                      <Badge variant="warning">지연</Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">최근 문서</h3>
          </div>
          <div className="divide-y divide-border">
            {documents.slice(0, 5).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{doc.fileName}</p>
                  <p className="text-xs text-muted">{doc.siteName}</p>
                </div>
                <div className="text-right">
                  <Badge variant={doc.analysisStatus === "done" ? "success" : "default"}>
                    {doc.analysisStatus === "done" ? "분석 완료" : doc.analysisStatus}
                  </Badge>
                  <p className="mt-1 text-xs text-muted">
                    {formatMonthLabel(doc.uploadedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
