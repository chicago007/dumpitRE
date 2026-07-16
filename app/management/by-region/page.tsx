"use client";

import { AppShell } from "@/components/layout/app-shell";
import { RegionRankPanel } from "@/components/management/portfolio-analytics";
import {
  PortfolioPageFrame,
  useLabPortfolio,
} from "@/components/management/use-lab-portfolio";

export default function ByRegionPage() {
  const { portfolio, loading } = useLabPortfolio();

  return (
    <AppShell title="지역별 현황">
      <div className="mx-auto max-w-7xl">
        <PortfolioPageFrame loading={loading} portfolio={portfolio}>
          {(funds) => <RegionRankPanel funds={funds} />}
        </PortfolioPageFrame>
      </div>
    </AppShell>
  );
}
