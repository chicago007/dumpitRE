"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { mergeLabProgressIntoFunds } from "@/lib/lab/merge-progress";
import type { LabFund, LabPortfolioSnapshot, LabProgressRow } from "@/lib/types";

export function useLabPortfolio() {
  const [raw, setRaw] = useState<LabPortfolioSnapshot | null>(null);
  const [progressRows, setProgressRows] = useState<LabProgressRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/lab-portfolio", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/lab-progress", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => []),
    ])
      .then(([data, progress]) => {
        setRaw(data as LabPortfolioSnapshot);
        setProgressRows(Array.isArray(progress) ? (progress as LabProgressRow[]) : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const portfolio = useMemo(() => {
    if (!raw) return null;
    return {
      ...raw,
      funds: mergeLabProgressIntoFunds(raw.funds, progressRows),
    };
  }, [raw, progressRows]);

  return {
    portfolio,
    loading,
    funds: portfolio?.funds ?? ([] as LabFund[]),
    progressRows,
    refresh,
  };
}

export function PortfolioPageFrame({
  loading,
  portfolio,
  children,
}: {
  loading: boolean;
  portfolio: LabPortfolioSnapshot | null;
  children: (funds: LabFund[]) => ReactNode;
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
