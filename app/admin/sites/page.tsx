"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { RequireAdmin } from "@/components/auth/require-admin";
import { SiteCard } from "@/components/sites/site-card";
import { Pill } from "@/components/ui/pill";
import type { Site } from "@/lib/types";

const filters = [
  { id: "all", label: "전체" },
  { id: "in_progress", label: "진행중" },
  { id: "planned", label: "예정" },
  { id: "completed", label: "완료" },
];

export default function AdminSitesProgressPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/sites", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data?.error === "string" ? data.error : `불러오기 실패 (${res.status})`
          );
        }
        return data as Site[];
      })
      .then((data) => {
        if (!cancelled) setSites(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "사업장 목록을 불러오지 못했습니다.");
          setSites([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered =
    filter === "all" ? sites : sites.filter((s) => s.status === filter);

  const delayedOnly = filter === "delayed";
  const display = delayedOnly
    ? sites.filter(
        (s) =>
          s.status === "in_progress" &&
          s.latestProgressPct != null &&
          s.plannedProgressPct != null &&
          s.latestProgressPct < s.plannedProgressPct - 5
      )
    : filtered;

  return (
    <RequireAdmin>
    <AppShell title="관리자 · 전체 사업장 공정율">
      <div className="mx-auto max-w-6xl space-y-4">
        <p className="text-xs text-muted">
          COST CM 기준 사업장별 상세 공정율입니다. 일반 화면의 전체 현황에는 실행공정율만
          표시됩니다.{" "}
          <Link href="/admin" className="text-accent underline">
            상품/사업장 마스터
          </Link>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <Pill key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </Pill>
          ))}
          <Pill active={filter === "delayed"} onClick={() => setFilter("delayed")}>
            지연
          </Pill>
          <span className="ml-auto text-sm text-muted">
            {display.length} / {sites.length} 사업장
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <p className="text-sm text-muted">불러오는 중…</p>
          ) : error ? (
            <div className="col-span-full rounded-lg border border-dashed border-border bg-card p-6 text-sm">
              <p className="text-muted">{error}</p>
              <p className="mt-2 text-xs text-muted">
                Supabase 연결이 안 되면 로컬 시드 데이터로 대체됩니다. 개발 서버가 실행 중인지
                확인한 뒤 새로고침해 보세요.
              </p>
            </div>
          ) : display.length === 0 ? (
            <p className="text-sm text-muted">표시할 사업장이 없습니다.</p>
          ) : (
            display.map((site) => <SiteCard key={site.id} site={site} />)
          )}
        </div>
      </div>
    </AppShell>
    </RequireAdmin>
  );
}
