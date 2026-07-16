"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LabPortfolioSnapshot } from "@/lib/types";

export function useLabPortfolio() {
  const [portfolio, setPortfolio] = useState<LabPortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch("/api/lab-portfolio", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: LabPortfolioSnapshot) => setPortfolio(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { portfolio, loading, funds: portfolio?.funds ?? [] };
}

export function PortfolioPageFrame({
  loading,
  portfolio,
  children,
}: {
  loading: boolean;
  portfolio: LabPortfolioSnapshot | null;
  children: (funds: LabPortfolioSnapshot["funds"]) => ReactNode;
}) {
  if (loading && !portfolio) {
    return <p className="text-sm text-muted">불러오는 중…</p>;
  }
  if (!portfolio) {
    return (
      <div className="shadow-card rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm text-muted">아직 업로드된 관리현황이 없습니다.</p>
        <Link href="/upload" className="text-link mt-3 inline-block text-sm hover:underline">
          업로드에서 관리현황 엑셀 올리기
        </Link>
      </div>
    );
  }
  return <>{children(portfolio.funds)}</>;
}
