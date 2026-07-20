"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { LabRoundCard } from "@/components/management/fund-panels";
import { useLabPortfolio } from "@/components/management/use-lab-portfolio";
import {
  decodeSiteParam,
  siteKey,
  sortLabFunds,
} from "@/lib/lab/portfolio-ui";
import { cn } from "@/lib/utils";
import type { LabFund } from "@/lib/types";

export default function ManagementSitesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteFilter = decodeSiteParam(searchParams.get("site"));
  const labParam = searchParams.get("lab");

  const { portfolio, loading, refresh } = useLabPortfolio();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, LabFund>>({});

  const selectableFunds = useMemo(() => {
    if (!portfolio) return [] as LabFund[];
    let list = portfolio.funds.map((f) => localOverrides[f.id] ?? f);
    if (siteFilter) {
      list = list.filter((f) => siteKey(f) === siteFilter);
    }
    return sortLabFunds(list);
  }, [portfolio, siteFilter, localOverrides]);

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

  function handleFundUpdated(fund: LabFund) {
    setLocalOverrides((prev) => ({ ...prev, [fund.id]: fund }));
    void refresh();
  }

  const siteLabel =
    siteFilter === "__none__"
      ? "사업장 미기재"
      : siteFilter
        ? siteFilter
        : null;

  function shortLabLabel(name: string) {
    const m = name.match(/(\d+)\s*호/);
    return m ? `${m[1]}호` : name;
  }

  return (
    <AppShell title="사업장별(회차별) 현황">
      <div className="mx-auto max-w-7xl">
        {loading && !portfolio ? (
          <p className="text-sm text-muted">불러오는 중…</p>
        ) : !portfolio ? (
          <EmptyUpload />
        ) : selectableFunds.length === 0 ? (
          <p className="text-sm text-muted">표시할 부동산랩이 없습니다.</p>
        ) : (
          <div className="flex h-[calc(100dvh-8.5rem)] min-h-[28rem] gap-4 overflow-hidden">
            {/* 왼쪽: 부동산랩 목록 (보조 네비) */}
            <aside
              className="flex w-[4.5rem] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100/90"
            >
              <div className="flex shrink-0 items-center justify-between gap-1 border-b border-border/60 px-1.5 py-2.5">
                <p className="text-[10px] font-medium tracking-wide text-neutral-400">
                  부동산랩
                </p>
                <span className="text-[10px] text-neutral-400">{selectableFunds.length}</span>
              </div>
              {siteLabel ? (
                <p
                  className="shrink-0 truncate border-b border-border/60 px-1.5 py-1.5 text-[10px] text-neutral-400"
                  title={siteLabel}
                >
                  필터
                </p>
              ) : null}
              <div className="min-h-0 flex-1 overflow-y-auto p-1">
                {selectableFunds.map((fund) => {
                  const active = fund.id === selectedId;
                  const label = shortLabLabel(fund.name);
                  return (
                    <button
                      key={fund.id}
                      type="button"
                      onClick={() => selectLab(fund.id)}
                      title={fund.name}
                      className={cn(
                        "mb-0.5 block w-full rounded-md px-1 py-1.5 text-center text-sm tabular-nums whitespace-nowrap transition-colors",
                        active
                          ? "bg-accent font-semibold text-accent-foreground shadow-sm"
                          : "font-medium text-slate-600 hover:bg-white hover:text-slate-900"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* 오른쪽: 사업장 현황 (주 영역) */}
            <section className="shadow-card min-h-0 min-w-0 flex-1 overflow-y-auto rounded-xl border border-border bg-card">
              {selectedFund ? (
                <LabRoundCard
                  fund={selectedFund}
                  embedded
                  onFundUpdated={handleFundUpdated}
                />
              ) : (
                <p className="p-4 text-sm text-muted">왼쪽에서 부동산랩을 선택하세요.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EmptyUpload() {
  return (
    <div className="shadow-card rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <p className="text-sm text-muted">아직 업로드된 관리현황이 없습니다.</p>
      <Link href="/upload" className="mt-3 inline-block text-sm text-accent hover:underline">
        관리자 업로드에서 관리현황 엑셀 올리기
      </Link>
    </div>
  );
}
