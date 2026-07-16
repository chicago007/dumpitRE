"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PROPOSAL_CONDITION_ROWS,
  buildConditionColumnLabel,
  proposalConditionsToCsv,
  type ProposalConditionColumn,
} from "@/lib/analyzers/proposal-conditions";
import type { ProposalRegistrationPrompt } from "@/lib/types";
import type { ParsedProposal } from "@/lib/analyzers/proposal";

function toColumn(reg: ProposalRegistrationPrompt): ProposalConditionColumn {
  return {
    documentId: reg.documentId,
    fileName: reg.fileName,
    columnLabel: buildConditionColumnLabel(
      reg.parsed as ParsedProposal,
      reg.fileName
    ),
    parsed: reg.parsed as ParsedProposal,
    extractionSource: reg.extractionSource,
    extractionWarning: reg.extractionWarning ?? undefined,
  };
}

interface ProposalConditionsTableProps {
  registrations: ProposalRegistrationPrompt[];
  enriching?: boolean;
  onEnrich?: () => void;
  onSelect?: (documentId: string) => void;
  selectedDocumentId?: string | null;
}

export function ProposalConditionsTable({
  registrations,
  enriching,
  onEnrich,
  onSelect,
  selectedDocumentId,
}: ProposalConditionsTableProps) {
  if (registrations.length === 0) return null;

  const columns = registrations.map(toColumn);
  const multi = columns.length > 1;

  function downloadCsv() {
    const csv = "\uFEFF" + proposalConditionsToCsv(columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = multi
      ? `제안서_조건비교_${columns.length}건.csv`
      : `제안서_조건_${columns[0].columnLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyTsv() {
    const lines = [
      ["항목", ...columns.map((c) => c.columnLabel)].join("\t"),
      ...PROPOSAL_CONDITION_ROWS.map((row) =>
        [row.label, ...columns.map((c) => row.format(c.parsed))].join("\t")
      ),
    ];
    void navigator.clipboard.writeText(lines.join("\n"));
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {multi ? `투자 주요 조건 비교 (${columns.length}건)` : "투자 주요 조건"}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            추출 프롬프트 기준 항목입니다. Gemini 보강 후 CSV로 내려받을 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onEnrich ? (
            <Button
              type="button"
              variant="ghost"
              disabled={enriching}
              onClick={onEnrich}
            >
              {enriching ? "Gemini 추출 중…" : "Gemini로 조건 보강"}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={copyTsv}>
            표 복사
          </Button>
          <Button type="button" onClick={downloadCsv}>
            CSV 다운로드
          </Button>
        </div>
      </div>

      <div className="max-h-[28rem] overflow-auto rounded-md border border-border">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-50 text-left">
              <th className="sticky left-0 z-10 border-b border-r border-border bg-neutral-50 px-3 py-2 font-medium text-muted">
                항목
              </th>
              {columns.map((col) => {
                const active = selectedDocumentId === col.documentId;
                return (
                  <th
                    key={col.documentId}
                    className={`border-b border-border px-3 py-2 font-medium ${
                      active ? "bg-accent/10 text-accent" : "text-foreground"
                    }`}
                  >
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => onSelect?.(col.documentId)}
                      title={col.fileName}
                    >
                      <span className="block max-w-[12rem] truncate">
                        {col.columnLabel}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-normal text-muted">
                        {col.fileName}
                      </span>
                    </button>
                    <div className="mt-1">
                      <Badge
                        variant={
                          col.extractionSource === "gemini" ? "success" : "default"
                        }
                      >
                        {col.extractionSource === "gemini" ? "Gemini" : "규칙"}
                      </Badge>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {PROPOSAL_CONDITION_ROWS.map((row) => (
              <tr key={row.key} className="odd:bg-white even:bg-neutral-50/60">
                <th className="sticky left-0 z-10 border-r border-border bg-inherit px-3 py-2 text-left text-xs font-medium text-muted">
                  {row.label}
                </th>
                {columns.map((col) => (
                  <td
                    key={col.documentId}
                    className={`max-w-[14rem] px-3 py-2 align-top text-xs leading-snug ${
                      selectedDocumentId === col.documentId ? "bg-accent/5" : ""
                    }`}
                  >
                    <span className="break-words">{row.format(col.parsed)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {columns.some((c) => c.extractionWarning) ? (
        <ul className="mt-2 space-y-1 text-[11px] text-amber-800">
          {columns
            .filter((c) => c.extractionWarning)
            .map((c) => (
              <li key={c.documentId}>
                {c.columnLabel}: {c.extractionWarning}
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
