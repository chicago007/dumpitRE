"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Button } from "@/components/ui/button";
import { HorizontalScroll } from "@/components/ui/horizontal-scroll";
import { formatRateInput, canonicalRateInput } from "@/lib/lab/portfolio-ui";
import type { LabFund, LabFundStatus } from "@/lib/types";

type RowEdit = LabFund & { dirty?: boolean };

function PercentRateInput({
  value,
  onChange,
  className,
  readOnly,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  className: string;
  readOnly?: boolean;
}) {
  const [text, setText] = useState(() => formatRateInput(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(formatRateInput(value));
  }, [value, focused]);

  return (
    <input
      className={className}
      inputMode="decimal"
      value={text}
      readOnly={readOnly}
      onFocus={() => {
        if (!readOnly) setFocused(true);
      }}
      onChange={(e) => {
        if (!readOnly) setText(e.target.value);
      }}
      onBlur={() => {
        if (readOnly) return;
        setFocused(false);
        const parsed = canonicalRateInput(text);
        setText(parsed ?? "");
        onChange(parsed);
      }}
    />
  );
}

function eokToWon(eok: string): number | null {
  const t = eok.trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  // 100 미만이면 억 단위로 해석
  if (Math.abs(n) < 1000) return Math.round(n * 100_000_000);
  return Math.round(n);
}

function wonToEok(amount: number | null): string {
  if (amount == null) return "";
  return String(Number((amount / 100_000_000).toFixed(2)));
}

function paymentMap(fund: LabFund): Record<number, string> {
  const m: Record<number, string> = {};
  for (const p of fund.interestPayments ?? []) {
    m[p.round] = p.raw ?? p.date;
  }
  return m;
}

export default function AdminPortfolioManagePage() {
  const [rows, setRows] = useState<RowEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const maxRound = useMemo(() => {
    let m = 6;
    for (const r of rows) {
      for (const p of r.interestPayments ?? []) m = Math.max(m, p.round);
    }
    return Math.min(Math.max(m + 1, 6), 20);
  }, [rows]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/lab-funds?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "불러오기 실패");
        setRows([]);
        return;
      }
      const funds = (data?.funds ?? []) as LabFund[];
      setRows(
        [...funds].sort((a, b) =>
          b.name.localeCompare(a.name, "ko", { numeric: true })
        )
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return rows;
    return rows.filter((r) =>
      [r.name, r.fundName, r.productCode, r.fundCode, r.siteAddress, r.businessDesc, r.developer, r.contractor]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(key))
    );
  }, [rows, q]);

  function patchRow(id: string, patch: Partial<RowEdit>) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch, dirty: true } : r))
    );
  }

  function setPayment(id: string, round: number, date: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const map = paymentMap(r);
        if (date.trim()) map[round] = date.trim();
        else delete map[round];
        const interestPayments = Object.entries(map)
          .map(([roundStr, d]) => ({
            round: Number(roundStr),
            date: d,
            raw: d,
          }))
          .sort((a, b) => a.round - b.round);
        return { ...r, interestPayments, dirty: true };
      })
    );
  }

  async function saveRow(row: RowEdit) {
    setSavingId(row.id);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/lab-funds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          name: row.name,
          fundName: row.fundName,
          fundCode: row.fundCode,
          productCode: row.productCode,
          siteAddress: row.siteAddress,
          businessDesc: row.businessDesc,
          purchaseAgency: row.purchaseAgency,
          trustType: row.trustType,
          trustCompany: row.trustCompany,
          developer: row.developer,
          contractor: row.contractor,
          landArea: row.landArea,
          buildingArea: row.buildingArea,
          totalFloorArea: row.totalFloorArea,
          buildingScale: row.buildingScale,
          householdCount: row.householdCount,
          setupDate: row.setupDate,
          maturityDate: row.maturityDate,
          loanMaturityDate: row.loanMaturityDate,
          repaymentDate: row.repaymentDate,
          setupAmount: row.setupAmount,
          balance: row.balance,
          interestRate: row.interestRate,
          feeRate: row.feeRate,
          actualProgressPct: row.actualProgressPct,
          plannedProgressPct: row.plannedProgressPct,
          vsPlan: row.vsPlan,
          note: row.note,
          progressComment: row.progressComment,
          status: row.status,
          interestPayments: row.interestPayments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "저장 실패");
        return;
      }
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...data.fund, dirty: false } : r))
      );
      setMessage(`${data.fund.name} 저장됨`);
    } finally {
      setSavingId(null);
    }
  }

  async function removeRow(row: RowEdit) {
    if (!confirm(`${row.name}을(를) 전체현황에서 삭제할까요?`)) return;
    setMessage(null);
    const res = await fetch(
      `/api/admin/lab-funds?id=${encodeURIComponent(row.id)}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "삭제 실패");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setMessage(data.message ?? "삭제됨");
  }

  function exitEdit() {
    setEditing(false);
    setMessage(null);
    void refresh();
  }

  const cell =
    "min-w-[8rem] border border-border bg-white px-1.5 py-1 text-xs outline-none focus:border-accent focus:ring-1 focus:ring-accent/30";
  const cellView =
    "min-w-[8rem] border border-border bg-transparent px-1.5 py-1 text-xs outline-none";
  const fieldClass = editing ? cell : cellView;
  const head =
    "sticky top-0 z-10 border border-border bg-neutral-100 px-2 py-2 text-left text-[11px] font-semibold whitespace-nowrap";

  return (
    <RequireAdmin>
      <AppShell
        title="관리자 · 사업장관리"
        action={
          editing ? (
            <Button type="button" variant="secondary" className="h-8 text-xs" onClick={exitEdit}>
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
          )
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-muted">
            이 테이블이 <strong>마스터</strong>입니다. 전체현황·사업장별(회차별)은 여기를 표시합니다.{" "}
            {editing
              ? "셀을 수정한 뒤 저장하세요."
              : "상단 「수정」을 누르면 편집할 수 있습니다."}{" "}
            <Link href="/upload" className="text-accent underline">
              관리현황 엑셀 업로드
            </Link>
            또는 엑셀로 다시 받을 수 있습니다.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              className="w-64 rounded-md border border-border px-3 py-1.5 text-sm"
              placeholder="랩명·펀드·주소 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={refresh}>
              새로고침
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                window.location.href = `/api/admin/lab-funds?format=xlsx&t=${Date.now()}`;
              }}
            >
              엑셀 다운로드
            </Button>
            <span className="text-xs text-muted">
              {filtered.length} / {rows.length}건
              {editing && rows.some((r) => r.dirty) ? " · 미저장 변경 있음" : ""}
            </span>
            {message ? <span className="text-xs text-accent">{message}</span> : null}
          </div>

          {loading ? (
            <p className="text-sm text-muted">불러오는 중…</p>
          ) : (
            <HorizontalScroll className="max-h-[calc(100vh-12rem)] overflow-y-auto rounded-lg border border-border">
              <table className="min-w-max border-collapse text-xs">
                <thead>
                  <tr>
                    <th className={`${head} sticky left-0 z-20 min-w-[9rem]`}>랩명</th>
                    <th className={head}>상태</th>
                    <th className={head}>펀드명</th>
                    <th className={head}>상품코드</th>
                    <th className={head}>펀드코드</th>
                    <th className={head}>사업장 주소</th>
                    <th className={head}>사업내용</th>
                    <th className={head}>매입기관</th>
                    <th className={head}>신탁사</th>
                    <th className={head}>신탁방식</th>
                    <th className={head}>시행사</th>
                    <th className={head}>시공사</th>
                    <th className={head}>대지면적</th>
                    <th className={head}>건축면적</th>
                    <th className={head}>연면적</th>
                    <th className={head}>건축규모</th>
                    <th className={head}>세대수</th>
                    <th className={head}>금리(%)</th>
                    <th className={head}>수수료(%)</th>
                    <th className={head}>설정액(억)</th>
                    <th className={head}>잔액(억)</th>
                    <th className={head}>설정일</th>
                    <th className={head}>펀드만기일</th>
                    <th className={head}>대출만기일</th>
                    <th className={head}>상환일</th>
                    <th className={head}>실행공정(%)</th>
                    <th className={head}>계획공정(%)</th>
                    <th className={head}>비고</th>
                    {Array.from({ length: maxRound }, (_, i) => (
                      <th key={i + 1} className={head}>
                        {i + 1}차지급
                      </th>
                    ))}
                    {editing ? (
                      <th className={`${head} sticky right-0 z-20`}>작업</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const pays = paymentMap(row);
                    return (
                      <tr
                        key={row.id}
                        className={
                          editing && row.dirty
                            ? "bg-amber-50/50"
                            : "odd:bg-neutral-50/40"
                        }
                      >
                        <td className="sticky left-0 z-10 border border-border bg-inherit p-0">
                          <input
                            className={`${fieldClass} w-36 font-medium`}
                            value={row.name}
                            readOnly={!editing}
                            onChange={(e) =>
                              editing && patchRow(row.id, { name: e.target.value })
                            }
                          />
                        </td>
                        <td className="border border-border p-0">
                          {editing ? (
                            <select
                              className={`${fieldClass} w-24`}
                              value={row.status}
                              onChange={(e) =>
                                patchRow(row.id, {
                                  status: e.target.value as LabFundStatus,
                                })
                              }
                            >
                              <option value="active">진행중</option>
                              <option value="repaid">상환</option>
                              <option value="unknown">기타</option>
                            </select>
                          ) : (
                            <span className={`${fieldClass} inline-block w-24`}>
                              {row.status === "active"
                                ? "진행중"
                                : row.status === "repaid"
                                  ? "상환"
                                  : "기타"}
                            </span>
                          )}
                        </td>
                        {(
                          [
                            ["fundName", row.fundName, "w-32"],
                            ["productCode", row.productCode, "w-28"],
                            ["fundCode", row.fundCode, "w-28"],
                            ["siteAddress", row.siteAddress, "w-52"],
                            ["businessDesc", row.businessDesc, "w-40"],
                            ["purchaseAgency", row.purchaseAgency, "w-20"],
                            ["trustCompany", row.trustCompany, "w-32"],
                            ["trustType", row.trustType, "w-32"],
                            ["developer", row.developer, "w-32"],
                            ["contractor", row.contractor, "w-32"],
                            ["landArea", row.landArea, "w-28"],
                            ["buildingArea", row.buildingArea, "w-28"],
                            ["totalFloorArea", row.totalFloorArea, "w-28"],
                            ["buildingScale", row.buildingScale, "w-28"],
                            ["householdCount", row.householdCount, "w-20"],
                          ] as const
                        ).map(([key, val, width]) => (
                          <td key={key} className="border border-border p-0">
                            <input
                              className={`${fieldClass} ${width}`}
                              value={val ?? ""}
                              readOnly={!editing}
                              onChange={(e) =>
                                editing &&
                                patchRow(row.id, { [key]: e.target.value || null })
                              }
                            />
                          </td>
                        ))}
                        <td className="border border-border p-0">
                          <PercentRateInput
                            className={`${fieldClass} w-16`}
                            value={row.interestRate}
                            readOnly={!editing}
                            onChange={(interestRate) =>
                              patchRow(row.id, { interestRate })
                            }
                          />
                        </td>
                        <td className="border border-border p-0">
                          <PercentRateInput
                            className={`${fieldClass} w-16`}
                            value={row.feeRate}
                            readOnly={!editing}
                            onChange={(feeRate) => patchRow(row.id, { feeRate })}
                          />
                        </td>
                        <td className="border border-border p-0">
                          <input
                            className={`${fieldClass} w-20`}
                            value={wonToEok(row.setupAmount)}
                            readOnly={!editing}
                            onChange={(e) =>
                              editing &&
                              patchRow(row.id, {
                                setupAmount: eokToWon(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="border border-border p-0">
                          <input
                            className={`${fieldClass} w-20`}
                            value={wonToEok(row.balance)}
                            readOnly={!editing}
                            onChange={(e) =>
                              editing &&
                              patchRow(row.id, {
                                balance: eokToWon(e.target.value),
                              })
                            }
                          />
                        </td>
                        {(
                          [
                            ["setupDate", row.setupDate],
                            ["maturityDate", row.maturityDate],
                            ["loanMaturityDate", row.loanMaturityDate],
                            ["repaymentDate", row.repaymentDate],
                          ] as const
                        ).map(([key, val]) => (
                          <td key={key} className="border border-border p-0">
                            <input
                              className={`${fieldClass} w-28`}
                              placeholder={editing ? "YYYY-MM-DD" : undefined}
                              value={val ?? ""}
                              readOnly={!editing}
                              onChange={(e) =>
                                editing &&
                                patchRow(row.id, { [key]: e.target.value || null })
                              }
                            />
                          </td>
                        ))}
                        <td className="border border-border p-0">
                          <input
                            className={`${fieldClass} w-16`}
                            value={row.actualProgressPct ?? ""}
                            readOnly={!editing}
                            onChange={(e) =>
                              editing &&
                              patchRow(row.id, {
                                actualProgressPct: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                          />
                        </td>
                        <td className="border border-border p-0">
                          <input
                            className={`${fieldClass} w-16`}
                            value={row.plannedProgressPct ?? ""}
                            readOnly={!editing}
                            onChange={(e) =>
                              editing &&
                              patchRow(row.id, {
                                plannedProgressPct: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                          />
                        </td>
                        <td className="border border-border p-0">
                          <input
                            className={`${fieldClass} w-40`}
                            value={row.note ?? ""}
                            readOnly={!editing}
                            onChange={(e) =>
                              editing &&
                              patchRow(row.id, { note: e.target.value || null })
                            }
                          />
                        </td>
                        {Array.from({ length: maxRound }, (_, i) => (
                          <td key={i + 1} className="border border-border p-0">
                            <input
                              className={`${fieldClass} w-28`}
                              placeholder={editing ? "YYYY-MM-DD" : undefined}
                              value={pays[i + 1] ?? ""}
                              readOnly={!editing}
                              onChange={(e) =>
                                editing && setPayment(row.id, i + 1, e.target.value)
                              }
                            />
                          </td>
                        ))}
                        {editing ? (
                          <td className="sticky right-0 z-10 border border-border bg-inherit px-2 py-1 whitespace-nowrap">
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                className="h-7 px-2 text-[11px]"
                                disabled={!row.dirty || savingId === row.id}
                                onClick={() => saveRow(row)}
                              >
                                {savingId === row.id ? "…" : "저장"}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => removeRow(row)}
                              >
                                삭제
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </HorizontalScroll>
          )}
        </div>
      </AppShell>
    </RequireAdmin>
  );
}
