"use client";

import { AppShell } from "@/components/layout/app-shell";
import { InterestSchedulePanel } from "@/components/management/portfolio-analytics";
import {
  PortfolioPageFrame,
  useLabPortfolio,
} from "@/components/management/use-lab-portfolio";

export default function InterestSchedulePage() {
  const { portfolio, loading } = useLabPortfolio();

  return (
    <AppShell title="이자 분배 스케줄">
      <div className="mx-auto max-w-7xl">
        <PortfolioPageFrame loading={loading} portfolio={portfolio}>
          {(funds) => <InterestSchedulePanel funds={funds} />}
        </PortfolioPageFrame>
      </div>
    </AppShell>
  );
}
