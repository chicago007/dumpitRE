"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { ProductMaster } from "@/lib/types";

const emptyForm = {
  labName: "",
  fundName: "",
  siteAddress: "",
};

function fieldWidthCh(value: string, placeholder: string, min = 8) {
  const len = Math.max(value.length, placeholder.length, min);
  return `${len + 3}ch`;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const labWidth = useMemo(
    () => fieldWidthCh(form.labName, "부동산랩 61호"),
    [form.labName]
  );
  const fundWidth = useMemo(
    () => fieldWidthCh(form.fundName, "엘엔에스 제46호", 10),
    [form.fundName]
  );

  const refresh = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/products")
      .then((r) => r.json())
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          labName: form.labName,
          fundName: form.fundName || null,
          siteAddress: form.siteAddress,
          siteName: form.labName,
          isNewSite: !editingId,
          aliases: [form.labName, form.fundName, form.siteAddress].filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "저장 실패");
        return;
      }
      setMessage(data.message ?? "저장됨");
      setForm(emptyForm);
      setEditingId(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(p: ProductMaster) {
    setEditingId(p.id);
    setForm({
      labName: p.labName,
      fundName: p.fundName ?? "",
      siteAddress: p.siteAddress,
    });
  }

  async function remove(id: string) {
    if (!confirm("이 상품을 삭제할까요? 전체현황의 해당 랩도 함께 제거됩니다.")) return;
    const res = await fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setMessage(data.message ?? (res.ok ? "삭제됨" : "삭제 실패"));
    refresh();
  }

  return (
    <RequireAdmin>
    <AppShell title="관리자 · 상품/사업장">
      <div className="mx-auto max-w-6xl space-y-6">
        <p className="text-xs text-muted">
          랩명·펀드명·사업장 주소를 등록합니다. 제안서에 랩/펀드가 없으면 업로드 시 여기서 등록한
          정보로 매칭하거나, 신규 상품으로 수기 등록합니다.{" "}
          <Link href="/admin/sites" className="text-accent underline">
            전체 사업장 공정율
          </Link>
          은 관리자만 확인합니다.
        </p>

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">
            {editingId ? "상품 수정" : "신규 상품 등록"}
          </h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block shrink-0 text-xs">
              <span className="text-muted">랩명</span>
              <input
                className="mt-1 block rounded-md border border-border bg-white px-3 py-2 text-sm"
                style={{ width: labWidth }}
                value={form.labName}
                onChange={(e) => setForm((f) => ({ ...f, labName: e.target.value }))}
                placeholder="부동산랩 61호"
              />
            </label>
            <label className="block shrink-0 text-xs">
              <span className="text-muted">펀드명</span>
              <input
                className="mt-1 block rounded-md border border-border bg-white px-3 py-2 text-sm"
                style={{ width: fundWidth }}
                value={form.fundName}
                onChange={(e) => setForm((f) => ({ ...f, fundName: e.target.value }))}
                placeholder="엘엔에스 제46호"
              />
            </label>
            <label className="block min-w-[16rem] flex-1 text-xs">
              <span className="text-muted">사업장 주소</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                value={form.siteAddress}
                onChange={(e) => setForm((f) => ({ ...f, siteAddress: e.target.value }))}
                placeholder="서울 강동구 길동 228-1"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving}>
              {saving ? "저장 중…" : editingId ? "수정 저장" : "신규 등록"}
            </Button>
            {editingId ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                취소
              </Button>
            ) : null}
          </div>
          {message ? <p className="mt-2 text-xs text-muted">{message}</p> : null}
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs text-muted">
              등록된 상품 목록 ({products.length}) · 랩/펀드 미입력 우선 · 랩명 내림차순
            </p>
          </div>
          <div className="max-h-[min(60vh,640px)] overflow-auto">
            {loading ? (
              <p className="p-4 text-sm text-muted">불러오는 중…</p>
            ) : (
              <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="sticky top-0 bg-neutral-50 px-4 py-2.5 font-medium">랩명</th>
                    <th className="sticky top-0 bg-neutral-50 px-4 py-2.5 font-medium">펀드명</th>
                    <th className="sticky top-0 bg-neutral-50 px-4 py-2.5 font-medium">사업장 주소</th>
                    <th className="sticky top-0 bg-neutral-50 px-4 py-2.5 font-medium">제안서 여부</th>
                    <th className="sticky top-0 bg-neutral-50 px-4 py-2.5 font-medium">규모</th>
                    <th className="sticky top-0 bg-neutral-50 px-4 py-2.5 font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-neutral-50/80">
                      <td className="whitespace-nowrap border-t border-border px-4 py-2.5 font-medium">
                        {p.labName || "—"}
                      </td>
                      <td className="max-w-[220px] truncate border-t border-border px-4 py-2.5 text-xs">
                        {p.fundName || "—"}
                      </td>
                      <td className="whitespace-nowrap border-t border-border px-4 py-2.5 text-xs">
                        {p.siteAddress || "—"}
                      </td>
                      <td className="whitespace-nowrap border-t border-border px-4 py-2.5">
                        {p.hasProposal ? (
                          <Badge variant="success">있음</Badge>
                        ) : (
                          <Badge variant="default">없음</Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap border-t border-border px-4 py-2.5 tabular-nums text-xs">
                        {p.contractAmount != null ? formatCurrency(p.contractAmount) : "—"}
                      </td>
                      <td className="whitespace-nowrap border-t border-border px-4 py-2.5">
                        <button
                          type="button"
                          className="mr-2 text-xs text-accent hover:underline"
                          onClick={() => startEdit(p)}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="text-xs text-danger hover:underline"
                          onClick={() => remove(p.id)}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </AppShell>
    </RequireAdmin>
  );
}
