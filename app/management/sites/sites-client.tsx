"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { LabRoundCard } from "@/components/management/fund-panels";
import {
  decodeSiteParam,
  siteKey,
  sortLabFunds,
} from "@/lib/lab/portfolio-ui";
import { cn } from "@/lib/utils";
import type { LabFund, LabPortfolioSnapshot } from "@/lib/types";

export default function ManagementSitesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteFilter = decodeSiteParam(searchParams.get("site"));
  const labParam = searchParams.get("lab");

  const [portfolio, setPortfolio] = useState<LabPortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch("/api/lab-portfolio")
      .then((r) => r.json())
      .then((data: LabPortfolioSnapshot) => setPortfolio(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** 선택 가능한 랩 목록 (사업장 필터 시 해당 사업장만) */
  const selectableFunds = useMemo(() => {
    if (!portfolio) return [] as LabFund[];
    let list = portfolio.funds;
    if (siteFilter) {
      list = list.filter((f) => siteKey(f) === siteFilter);
    }
    return sortLabFunds(list);
  }, [portfolio, siteFilter]);

  // URL / 데이터 로드 후 선택 동기화
  useEffect(() => {
    if (selectableFunds.length === 0) {
      setSelectedId(null);
      return;
    }
    if (labParam) {
      const byId = selectableFunds.find((f) => f.id === labParam || f.name === labParam);
      if (byId) {
        setSelectedId(byId.id);
        return;
      }
    }
    setSelectedId((prev) => {
      if (prev && selectableFunds.some((f) => f.id === prev)) return prev;
      return selectableFunds[0].id;
    });
  }, [selectableFunds, labParam]);

  const selectedFund = useMemo(
    () => selectableFunds.find((f) => f.id === selectedId) ?? null,
    [selectableFunds, selectedId]
  );

  function selectLab(id: string) {
    setSelectedId(id);
    const params = new URLSearchParams();
    params.set("lab", id);
    if (siteFilter) params.set("site", siteFilter);
    router.replace(`/management/sites?${params.toString()}`, { scroll: false });
  }

  const siteLabel =
    siteFilter === "__none__"
      ? "사업장 미기재"
      : siteFilter
        ? siteFilter
        : null;

  return (
    <AppShell title="사업장별(회차별) 현황">
      <div className="mx-auto max-w-4xl space-y-5">
        {loading && !portfolio ? (
          <p className="text-sm text-muted">불러오는 중…</p>
        ) : !portfolio ? (
          <EmptyUpload />
        ) : selectableFunds.length === 0 ? (
          <p className="text-sm text-muted">표시할 부동산랩이 없습니다.</p>
        ) : (
          <>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">사업장별(회차별) 현황</h2>
              <p className="mt-1 text-sm text-muted">
                부동산랩을 선택하면 회차별 이자지급을 확인합니다.
                {siteLabel ? ` · 사업장: ${siteLabel}` : ""}
              </p>
            </div>

            {/* 랩(회차/호) 선택 */}
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted">부동산랩 선택</p>
                <span className="text-xs text-muted">{selectableFunds.length}개</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {selectableFunds.map((fund) => {
                  const active = fund.id === selectedId;
                  return (
                    <button
                      key={fund.id}
                      type="button"
                      onClick={() => selectLab(fund.id)}
                      className={cn(
                        "shrink-0 rounded-lg border px-3 py-2 text-left transition-colors",
                        active
                          ? "border-accent bg-blue-50 text-accent shadow-sm"
                          : "border-border bg-white text-foreground hover:bg-neutral-50"
                      )}
                    >
                      <span className="block text-sm font-semibold whitespace-nowrap">
                        {fund.name}
                      </span>
                      <span className="mt-0.5 block max-w-[160px] truncate text-[11px] text-muted">
                        {fund.status === "active"
                          ? "운용중"
                          : fund.status === "repaid"
                            ? "상환완료"
                            : "미확인"}
                        {" · "}
                        {fund.interestPayments.length}회차
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 border-t border-border pt-3">
                <label className="sr-only" htmlFor="lab-select">
                  부동산랩 선택
                </label>
                <select
                  id="lab-select"
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  value={selectedId ?? ""}
                  onChange={(e) => selectLab(e.target.value)}
                >
                  {selectableFunds.map((fund) => (
                    <option key={fund.id} value={fund.id}>
                      {fund.name}
                      {fund.siteAddress ? ` — ${fund.siteAddress}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedFund && <LabRoundCard fund={selectedFund} />}
          </>
        )}
      </div>
    </AppShell>
  );
}

function EmptyUpload() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
      <p className="text-sm text-muted">아직 업로드된 관리현황이 없습니다.</p>
      <Link href="/upload" className="mt-3 inline-block text-sm text-accent hover:underline">
        업로드에서 관리현황 엑셀 올리기
      </Link>
    </div>
  );
}
