"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { RequireAdmin } from "@/components/auth/require-admin";
import {
  filterFundsByStatus,
  LabStatusFilterTabs,
  type LabStatusFilter,
} from "@/components/management/lab-status-filter";
import { EntityRankPanel } from "@/components/management/portfolio-analytics";
import {
  PortfolioPageFrame,
  useLabPortfolio,
} from "@/components/management/use-lab-portfolio";

export default function ByEntityPage() {
  const { portfolio, loading } = useLabPortfolio();
  const [filter, setFilter] = useState<LabStatusFilter>("all");

  return (
    <RequireAdmin>
      <AppShell
        title="업체별 현황"
        action={
          portfolio ? (
            <LabStatusFilterTabs value={filter} onChange={setFilter} />
          ) : undefined
        }
      >
        <div className="mx-auto max-w-7xl">
          <PortfolioPageFrame loading={loading} portfolio={portfolio}>
            {(funds) => (
              <EntityRankPanel
                key={filter}
                funds={filterFundsByStatus(funds, filter)}
              />
            )}
          </PortfolioPageFrame>
        </div>
      </AppShell>
    </RequireAdmin>
  );
}
