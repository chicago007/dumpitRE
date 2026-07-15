"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { ProposalRegistrationPrompt } from "@/lib/types";

export type RegMode = "new" | "existing" | null;

interface ProposalRegistrationPanelProps {
  registration: ProposalRegistrationPrompt;
  saving: boolean;
  onClose: () => void;
  onConfirm: (input: {
    mode: "new" | "existing";
    labFundId: string;
    newLabName: string;
  }) => void;
}

export function ProposalRegistrationPanel({
  registration,
  saving,
  onClose,
  onConfirm,
}: ProposalRegistrationPanelProps) {
  const [regMode, setRegMode] = useState<RegMode>(
    registration.matchedLabFundId ? "existing" : null
  );
  const [selectedLabFundId, setSelectedLabFundId] = useState(
    registration.matchedLabFundId ?? ""
  );
  const [labFilter, setLabFilter] = useState("");
  const [newLabName, setNewLabName] = useState(registration.suggestedLabName ?? "");

  useEffect(() => {
    setSelectedLabFundId(registration.matchedLabFundId ?? "");
    setNewLabName(registration.suggestedLabName ?? "");
    setRegMode(registration.matchedLabFundId ? "existing" : null);
    setLabFilter("");
  }, [registration.documentId, registration.matchedLabFundId, registration.suggestedLabName]);

  const filteredLabs = useMemo(() => {
    const options = registration.labOptions ?? [];
    const q = labFilter.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      [o.name, o.fundName, o.siteAddress]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [registration.labOptions, labFilter]);

  return (
    <div
      id="proposal-registration"
      className="rounded-xl border-2 border-accent bg-white p-5 shadow-md"
    >
      <h2 className="text-base font-semibold text-accent">① 신규인가요, 기존인가요?</h2>
      <p className="mt-1 text-sm text-muted">{registration.question}</p>
      <p className="mt-2 text-xs text-muted">
        파일: {registration.fileName}
        {registration.suggestedLabName
          ? ` · 추출 랩: ${registration.suggestedLabName}`
          : ""}
        {registration.matchedLabel ? ` · 추천: ${registration.matchedLabel}` : ""}
        {registration.suggestedBudget != null
          ? ` · 추정규모 ${formatCurrency(registration.suggestedBudget)}`
          : ""}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setRegMode("new")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            regMode === "new" ? "bg-accent text-white" : "bg-neutral-100 text-muted"
          }`}
        >
          신규 부동산랩
        </button>
        <button
          type="button"
          onClick={() => setRegMode("existing")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            regMode === "existing" ? "bg-accent text-white" : "bg-neutral-100 text-muted"
          }`}
        >
          기존 부동산랩
        </button>
      </div>

      <div className="mt-4">
        {regMode === "new" && (
          <label className="block text-xs">
            <span className="text-muted">신규 랩명</span>
            <input
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
              value={newLabName}
              onChange={(e) => setNewLabName(e.target.value)}
              placeholder="예: 부동산랩 62호"
            />
          </label>
        )}

        {regMode === "existing" && (
          <div className="space-y-3">
            <label className="block text-xs">
              <span className="text-muted">부동산랩 검색</span>
              <input
                className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                value={labFilter}
                onChange={(e) => setLabFilter(e.target.value)}
                placeholder="호수·펀드명·주소"
              />
            </label>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border">
              {filteredLabs.length === 0 ? (
                <p className="p-3 text-xs text-muted">
                  등록된 부동산랩이 없습니다. 관리현황 엑셀을 먼저 올려 주세요.
                </p>
              ) : (
                filteredLabs.map((lab) => {
                  const active = selectedLabFundId === lab.id;
                  return (
                    <button
                      key={lab.id}
                      type="button"
                      onClick={() => setSelectedLabFundId(lab.id)}
                      className={`flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2 text-left last:border-b-0 ${
                        active ? "bg-accent/10 text-foreground" : "hover:bg-neutral-50"
                      }`}
                    >
                      <span className="text-sm font-medium">{lab.name}</span>
                      {(lab.fundName || lab.siteAddress) && (
                        <span className="line-clamp-2 text-[11px] text-muted">
                          {[lab.fundName, lab.siteAddress].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {!regMode && (
          <p className="text-sm text-muted">위에서 신규 또는 기존을 선택해 주세요.</p>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          나중에
        </Button>
        <Button
          onClick={() => {
            if (!regMode) return;
            onConfirm({ mode: regMode, labFundId: selectedLabFundId, newLabName });
          }}
          disabled={
            saving ||
            !regMode ||
            (regMode === "existing" && !selectedLabFundId) ||
            (regMode === "new" && !newLabName.trim())
          }
        >
          {saving ? "반영 중…" : "② 저장하고 전체현황에 반영"}
        </Button>
      </div>
    </div>
  );
}
