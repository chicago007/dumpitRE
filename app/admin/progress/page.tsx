"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Button } from "@/components/ui/button";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import type { LabProgressRow, MissingProgressLab } from "@/lib/types";

type RowEdit = LabProgressRow & { dirty?: boolean };

function fmtPct(v: number | null) {
  return v == null ? "—" : `${v.toFixed(2)}%`;
}

function numOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export default function AdminProgressPage() {
  const [rows, setRows] = useState<RowEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [missingLabs, setMissingLabs] = useState<MissingProgressLab[]>([]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/lab-progress", { cache: "no-store" }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "불러오기 실패");
        return data as LabProgressRow[];
      }),
      fetch("/api/lab-progress?missing=1", { cache: "no-store" }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) return [] as MissingProgressLab[];
        return data as MissingProgressLab[];
      }),
    ])
      .then(([progress, missing]) => {
        setRows(
          (Array.isArray(progress) ? progress : [])
            .map((r) => ({ ...r }))
            .sort((a, b) =>
              b.labName.localeCompare(a.labName, "ko", { numeric: true })
            )
        );
        setMissingLabs(Array.isArray(missing) ? missing : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "오류"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function patchRow(id: string, patch: Partial<LabProgressRow>) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch, dirty: true } : r))
    );
  }

  async function saveRow(row: RowEdit) {
    setSavingId(row.id);
    setMessage(null);
    try {
      const res = await fetch("/api/lab-progress", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          patch: {
            labName: row.labName,
            fundName: row.fundName,
            siteAddress: row.siteAddress,
            plannedProgressPct: row.plannedProgressPct,
            actualProgressPct: row.actualProgressPct,
            achievementPct: row.achievementPct,
            delayDays: row.delayDays,
            confirmedDate: row.confirmedDate,
            specialNotes: row.specialNotes,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "저장 실패");
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...(data.row as LabProgressRow), dirty: false } : r
        )
      );
      setMessage(`${row.labName} 저장됨`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "저장 오류");
    } finally {
      setSavingId(null);
    }
  }

  async function removeRow(row: RowEdit) {
    if (!confirm(`${row.labName} 공정율 행을 삭제할까요?`)) return;
    setSavingId(row.id);
    setMessage(null);
    try {
      const res = await fetch("/api/lab-progress", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "삭제 실패");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setMessage(`${row.labName} 삭제됨`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "삭제 오류");
    } finally {
      setSavingId(null);
    }
  }

  function exitEdit() {
    setEditing(false);
    setMessage(null);
    refresh();
  }

  const inputClass =
    "w-full min-w-[4.5rem] rounded border border-border bg-white px-1.5 py-1 text-xs tabular-nums";

  return (
    <RequireAdmin>
      <AppShell
        title="관리자 · 공정율 현황"
        action={
          <div className="flex items-center gap-2">
            {editing ? (
              <Button
                type="button"
                variant="secondary"
                className="h-8 text-xs"
                onClick={exitEdit}
              >
                조회 모드
              </Button>
            ) : (
              <Button
                type="button"
                className="h-8 text-xs"
                onClick={() => setEditing(true)}
                disabled={rows.length === 0}
              >
                수정
              </Button>
            )}
            <Link
              href="/upload"
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-card hover:bg-accent/5"
            >
              기성보고서 업로드
            </Link>
            <Link
              href="/admin/review"
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-card hover:bg-accent/5"
            >
              검토 대기함
            </Link>
          </div>
        }
      >
        <div className="mx-auto max-w-7xl space-y-4">
          <p className="text-xs text-muted">
            기성보고서·공정확인서 기준 랩별 공정율입니다. 진행중 사업장은 자료가 없어도
            목록에 표시됩니다.
            {editing
              ? " 셀을 수정한 뒤 행마다 저장하세요."
              : " 상단 「수정」을 누르면 편집할 수 있습니다."}
          </p>

          {message ? <p className="text-xs text-accent">{message}</p> : null}
          {!loading && missingLabs.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm">
              <p className="font-medium text-amber-900">
                이번 달 기성 보고 미제출 ({missingLabs.length}곳)
              </p>
              <p className="mt-1 text-xs text-amber-800/90">
                {missingLabs
                  .slice(0, 12)
                  .map((l) => l.labName)
                  .join(", ")}
                {missingLabs.length > 12 ? ` 외 ${missingLabs.length - 12}곳` : ""}
              </p>
            </div>
          ) : null}
          {loading ? (
            <p className="text-sm text-muted">불러오는 중…</p>
          ) : error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : rows.length === 0 ? (
            <div className="shadow-card rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm text-muted">등록된 공정율이 없습니다.</p>
              <Link href="/upload" className="text-link mt-3 inline-block text-sm hover:underline">
                업로드에서 기성보고서 올리기
              </Link>
            </div>
          ) : (
            <HorizontalScroll className="shadow-card rounded-xl border border-border bg-card">
              <table className="min-w-[960px] w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs text-muted">
                    <th className="px-3 py-2.5 font-medium">랩명</th>
                    <th className="px-3 py-2.5 font-medium">펀드명</th>
                    <th className="px-3 py-2.5 font-medium">사업장 주소</th>
                    <th className="px-3 py-2.5 font-medium text-right">계획</th>
                    <th className="px-3 py-2.5 font-medium text-right">실적</th>
                    <th className="px-3 py-2.5 font-medium text-right">달성률</th>
                    <th className="px-3 py-2.5 font-medium text-right">지연일수</th>
                    <th className="px-3 py-2.5 font-medium">확인일</th>
                    <th className="min-w-[180px] px-3 py-2.5 font-medium">특이사항</th>
                    {editing ? <th className="px-3 py-2.5 font-medium">저장</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) =>
                    editing ? (
                      <tr
                        key={row.id}
                        className={`border-b border-border/70 last:border-0 ${
                          row.dirty ? "bg-amber-50/60" : ""
                        }`}
                      >
                        <td className="px-2 py-1.5">
                          <input
                            className={inputClass}
                            value={row.labName}
                            onChange={(e) => patchRow(row.id, { labName: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className={inputClass}
                            value={row.fundName ?? ""}
                            onChange={(e) =>
                              patchRow(row.id, { fundName: e.target.value || null })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className={`${inputClass} min-w-[10rem]`}
                            value={row.siteAddress ?? ""}
                            onChange={(e) =>
                              patchRow(row.id, { siteAddress: e.target.value || null })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className={`${inputClass} text-right`}
                            inputMode="decimal"
                            value={row.plannedProgressPct ?? ""}
                            onChange={(e) =>
                              patchRow(row.id, {
                                plannedProgressPct: numOrNull(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className={`${inputClass} text-right`}
                            inputMode="decimal"
                            value={row.actualProgressPct ?? ""}
                            onChange={(e) =>
                              patchRow(row.id, {
                                actualProgressPct: numOrNull(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className={`${inputClass} text-right`}
                            inputMode="decimal"
                            value={row.achievementPct ?? ""}
                            onChange={(e) =>
                              patchRow(row.id, {
                                achievementPct: numOrNull(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className={`${inputClass} text-right`}
                            inputMode="decimal"
                            value={row.delayDays ?? ""}
                            onChange={(e) =>
                              patchRow(row.id, { delayDays: numOrNull(e.target.value) })
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="date"
                            className={inputClass}
                            value={row.confirmedDate ?? ""}
                            onChange={(e) =>
                              patchRow(row.id, {
                                confirmedDate: e.target.value || null,
                              })
                            }
                          />
                        </td>
                        <td className="min-w-[280px] px-2 py-1.5 align-top">
                          <textarea
                            rows={4}
                            className={`${inputClass} min-h-[5.5rem] min-w-[16rem] w-72 resize-y leading-snug`}
                            value={row.specialNotes ?? ""}
                            onChange={(e) =>
                              patchRow(row.id, {
                                specialNotes: e.target.value || null,
                              })
                            }
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5">
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              disabled={!row.dirty || savingId === row.id}
                              onClick={() => void saveRow(row)}
                              className="h-7 px-2 text-xs"
                            >
                              {savingId === row.id ? "…" : "저장"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={savingId === row.id}
                              onClick={() => void removeRow(row)}
                              className="h-7 px-2 text-xs text-danger"
                            >
                              삭제
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={row.id} className="border-b border-border/70 last:border-0">
                        <td className="whitespace-nowrap px-3 py-2.5 font-medium">
                          {row.labName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {row.fundName ?? "—"}
                        </td>
                        <td className="max-w-[220px] px-3 py-2.5 text-xs text-muted">
                          {row.siteAddress ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                          {fmtPct(row.plannedProgressPct)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                          {fmtPct(row.actualProgressPct)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                          {fmtPct(row.achievementPct)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                          {row.delayDays != null ? `${row.delayDays}일` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                          {row.confirmedDate ?? "—"}
                        </td>
                        <td className="max-w-[280px] px-3 py-2.5 text-xs text-muted">
                          {row.specialNotes ?? "—"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </HorizontalScroll>
          )}
        </div>
      </AppShell>
    </RequireAdmin>
  );
}
