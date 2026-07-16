"use client";

import { AppShell } from "@/components/layout/app-shell";
import { MaturitySchedulePanel } from "@/components/management/portfolio-analytics";
import {
  PortfolioPageFrame,
  useLabPortfolio,
} from "@/components/management/use-lab-portfolio";

export default function MaturityCalendarPage() {
  const { portfolio, loading } = useLabPortfolio();

  return (
    <AppShell title="만기 캘린더">
      <div className="mx-auto max-w-7xl">
        <PortfolioPageFrame loading={loading} portfolio={portfolio}>
          {(funds) => <MaturitySchedulePanel funds={funds} />}
        </PortfolioPageFrame>
      </div>
    </AppShell>
  );
}
