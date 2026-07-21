"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { LabRoundCard } from "@/components/management/fund-panels";
import { useLabPortfolio } from "@/components/management/use-lab-portfolio";
import {
  decodeSiteParam,
  siteKey,
  sortLabFunds,
} from "@/lib/lab/portfolio-ui";
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

  function labSelectLabel(fund: LabFund) {
    const m = fund.name.match(/(\d+)\s*호/);
    const labPart = m ? `${m[1]}호` : fund.name.replace(/^부동산랩\s*/, "").trim() || fund.name;
    const fundPart = fund.fundName?.trim();
    if (fundPart) return `부동산랩 ${labPart}/${fundPart}`;
    return `부동산랩 ${labPart}`;
  }

  const currentLabel = selectedFund ? labSelectLabel(selectedFund) : "부동산랩 선택";

  const labPicker =
    selectableFunds.length > 0 ? (
      <>
        <label className="relative inline-grid max-w-full items-center">
          <span className="sr-only">부동산랩 선택</span>
          <span
            className="invisible col-start-1 row-start-1 h-9 whitespace-pre py-1.5 pr-8 pl-2.5 text-sm font-medium"
            aria-hidden
          >
            {currentLabel}
          </span>
          <select
            className="col-start-1 row-start-1 h-9 w-full min-w-0 appearance-none rounded-lg border border-border bg-white py-1.5 pr-8 pl-2.5 text-sm font-medium text-foreground shadow-sm outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
            value={selectedId ?? ""}
            onChange={(e) => selectLab(e.target.value)}
          >
            {selectableFunds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {labSelectLabel(fund)}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
        </label>
        <span className="hidden shrink-0 text-xs text-muted sm:inline">
          전체 {selectableFunds.length}건
          {siteLabel ? ` · 필터: ${siteLabel}` : null}
        </span>
      </>
    ) : null;

  return (
    <AppShell title="사업장별(회차별) 현황" titleExtra={labPicker}>
      <div className="mx-auto max-w-7xl">
        {loading && !portfolio ? (
          <p className="text-sm text-muted">불러오는 중…</p>
        ) : !portfolio ? (
          <EmptyUpload />
        ) : selectableFunds.length === 0 ? (
          <p className="text-sm text-muted">표시할 부동산랩이 없습니다.</p>
        ) : (
          <div className="flex h-[calc(100dvh-8.5rem)] min-h-[28rem] flex-col overflow-hidden">
            <section className="shadow-card min-h-0 min-w-0 flex-1 overflow-y-auto rounded-xl border border-border bg-card">
              {selectedFund ? (
                <LabRoundCard
                  fund={selectedFund}
                  embedded
                  onFundUpdated={handleFundUpdated}
                />
              ) : (
                <p className="p-4 text-sm text-muted">부동산랩을 선택하세요.</p>
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
