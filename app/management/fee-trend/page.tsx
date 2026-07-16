"use client";

import { AppShell } from "@/components/layout/app-shell";
import { FeeTrendPanel } from "@/components/management/portfolio-analytics";
import {
  PortfolioPageFrame,
  useLabPortfolio,
} from "@/components/management/use-lab-portfolio";

export default function FeeTrendPage() {
  const { portfolio, loading } = useLabPortfolio();

  return (
    <AppShell title="수수료 추이">
      <div className="mx-auto max-w-7xl">
        <PortfolioPageFrame loading={loading} portfolio={portfolio}>
          {(funds) => <FeeTrendPanel funds={funds} />}
        </PortfolioPageFrame>
      </div>
    </AppShell>
  );
}
