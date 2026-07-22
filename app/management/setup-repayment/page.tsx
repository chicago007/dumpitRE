"use client";

import { AppShell } from "@/components/layout/app-shell";
import { RequireFullOverview } from "@/components/auth/require-full-overview";
import { SetupRepaymentPanel } from "@/components/management/portfolio-analytics";
import {
  PortfolioPageFrame,
  useLabPortfolio,
} from "@/components/management/use-lab-portfolio";

export default function SetupRepaymentPage() {
  const { portfolio, loading } = useLabPortfolio();

  return (
    <RequireFullOverview>
      <AppShell title="설정·상환 추이">
        <div className="mx-auto max-w-7xl">
          <PortfolioPageFrame loading={loading} portfolio={portfolio}>
            {(funds) => <SetupRepaymentPanel funds={funds} />}
          </PortfolioPageFrame>
        </div>
      </AppShell>
    </RequireFullOverview>
  );
}
