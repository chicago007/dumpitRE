"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LabProgressApplyResult } from "@/lib/types";

export interface LabOption {
  id: string;
  name: string;
  fundName: string | null;
  siteAddress: string | null;
}

interface ProgressMatchPanelProps {
  item: LabProgressApplyResult;
  labs: LabOption[];
  saving: boolean;
  onClose: () => void;
  onDefer?: () => void;
  onConfirm: (labFundId: string) => void;
}

export function ProgressMatchPanel({
  item,
  labs,
  saving,
  onClose,
  onDefer,
  onConfirm,
}: ProgressMatchPanelProps) {
  const row = item.row;
  const candidates = item.matchCandidates ?? [];
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setFilter("");
    const suggested = item.suggestedLabName;
    const firstCandidate = item.matchCandidates?.[0]?.labName;
    const name = suggested || firstCandidate;
    if (name) {
      const lab = labs.find((l) => l.name === name);
      setSelectedId(lab?.id ?? "");
    } else {
      setSelectedId("");
    }
  }, [
    row?.documentId,
    row?.sourceFileName,
    item.suggestedLabName,
    item.matchCandidates,
    labs,
  ]);

  const candidateNames = useMemo(
    () => new Set(candidates.map((c) => c.labName)),
    [candidates]
  );

  const orderedLabs = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = !q
      ? labs
      : labs.filter((o) =>
          [o.name, o.fundName, o.siteAddress]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q)
        );

    return [...filtered].sort((a, b) => {
      const ac = candidateNames.has(a.name) ? 0 : 1;
      const bc = candidateNames.has(b.name) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      const na = Number(a.name.match(/(\d+)\s*호/)?.[1] ?? 0);
      const nb = Number(b.name.match(/(\d+)\s*호/)?.[1] ?? 0);
      return nb - na;
    });
  }, [labs, filter, candidateNames]);

  if (!row) return null;

  const sharedSite = Boolean(
    item.needsConfirmation && candidates.length >= 2
  );

  return (
    <div className="rounded-xl border-2 border-amber-500 bg-white p-5 shadow-md">
      <h2 className="text-base font-semibold text-amber-900">
        공정율 · 부동산랩 확인
      </h2>
      <p className="mt-1 text-sm text-muted">{item.message}</p>
      {sharedSite ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">
          동일 사업장·다른 사업구조로 보입니다. 자동 저장하지 않습니다. 추천
          후보를 확인한 뒤 저장해 주세요. (닫아도 대기열에서 버리지 않습니다)
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        파일: {row.sourceFileName ?? "—"}
        {row.siteAddress ? ` · 추출주소: ${row.siteAddress}` : ""}
        {row.plannedProgressPct != null
          ? ` · 계획 ${row.plannedProgressPct}%`
          : ""}
        {row.actualProgressPct != null
          ? ` · 실적 ${row.actualProgressPct}%`
          : ""}
        {row.confirmedDate ? ` · 확인일 ${row.confirmedDate}` : ""}
      </p>

      {candidates.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-foreground">
            추천 후보 ({candidates.length})
          </p>
          <div className="flex flex-col gap-2">
            {candidates.map((c) => {
              const lab = labs.find((l) => l.name === c.labName);
              if (!lab) {
                return (
                  <div
                    key={c.labName}
                    className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted"
                  >
                    {c.labName}
                    {c.fundName ? ` · ${c.fundName}` : ""} (목록에 없음)
                  </div>
                );
              }
              return (
                <button
                  key={c.labName}
                  type="button"
                  onClick={() => setSelectedId(lab.id)}
                  className={`flex w-full flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left text-sm ${
                    selectedId === lab.id
                      ? "border-amber-600 bg-amber-50"
                      : "border-border hover:bg-neutral-50"
                  }`}
                >
                  <span className="font-medium">{lab.name}</span>
                  <span className="text-xs text-muted">
                    {[lab.fundName, lab.siteAddress].filter(Boolean).join(" · ") ||
                      "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-foreground">
          전체 부동산랩에서 검색
        </p>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="랩명·펀드·주소 검색"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border">
          {orderedLabs.map((lab) => (
            <button
              key={lab.id}
              type="button"
              onClick={() => setSelectedId(lab.id)}
              className={`flex w-full flex-col items-start gap-0.5 border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 ${
                selectedId === lab.id
                  ? "bg-accent/10 text-foreground"
                  : "hover:bg-neutral-50"
              }`}
            >
              <span className="font-medium">
                {lab.name}
                {candidateNames.has(lab.name) ? (
                  <span className="ml-2 text-[10px] font-normal text-amber-800">
                    동일주소 후보
                  </span>
                ) : null}
              </span>
              <span className="text-xs text-muted">
                {[lab.fundName, lab.siteAddress].filter(Boolean).join(" · ") ||
                  "—"}
              </span>
            </button>
          ))}
          {orderedLabs.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted">검색 결과가 없습니다.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!selectedId || saving}
          onClick={() => onConfirm(selectedId)}
        >
          {saving ? "반영 중…" : "선택한 랩에 공정율 저장"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={saving}
          onClick={() => (onDefer ?? onClose)()}
        >
          나중에 (대기열 유지)
        </Button>
      </div>
    </div>
  );
}
