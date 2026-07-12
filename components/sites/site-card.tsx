import Link from "next/link";
import type { Site } from "@/lib/types";
import { isDelayed, statusLabel } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SiteCardProps {
  site: Site;
}

export function SiteCard({ site }: SiteCardProps) {
  const delayed = isDelayed(site);
  const progressTone = delayed ? "red" : site.latestProgressPct != null && site.latestProgressPct >= 80 ? "green" : "blue";

  return (
    <Link
      href={`/sites/${site.id}`}
      className={cn(
        "block rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm",
        delayed ? "border-amber-300" : "border-border"
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug">{site.name}</h3>
        <Badge variant={delayed ? "warning" : site.status === "in_progress" ? "default" : "success"}>
          {statusLabel(site.status)}
        </Badge>
      </div>
      {site.latestProgressPct != null && (
        <ProgressBar value={site.latestProgressPct} label="공정" tone={progressTone} />
      )}
      {site.latestFundPct != null && (
        <div className="mt-2">
          <ProgressBar value={site.latestFundPct} label="자금" tone="green" />
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        {site.latestReportMonth
          ? `최근: ${site.latestReportMonth.slice(0, 7)} 공정율`
          : "보고서 없음"}
      </p>
    </Link>
  );
}
