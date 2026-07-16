"use client";

import { AppShell } from "@/components/layout/app-shell";
import { EntityRankPanel } from "@/components/management/portfolio-analytics";
import {
  PortfolioPageFrame,
  useLabPortfolio,
} from "@/components/management/use-lab-portfolio";

export default function ByEntityPage() {
  const { portfolio, loading } = useLabPortfolio();

  return (
    <AppShell title="업체별 현황">
      <div className="mx-auto max-w-7xl">
        <PortfolioPageFrame loading={loading} portfolio={portfolio}>
          {(funds) => <EntityRankPanel funds={funds} />}
        </PortfolioPageFrame>
      </div>
    </AppShell>
  );
}
