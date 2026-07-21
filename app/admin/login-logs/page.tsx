"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Button } from "@/components/ui/button";
import type { GuestLoginLog } from "@/lib/auth/guest-login-log";

function formatAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function AdminGuestLoginsPage() {
  const [logs, setLogs] = useState<GuestLoginLog[]>([]);
  const [source, setSource] = useState<"supabase" | "local" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/guest-logins?limit=200", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "불러오기 실패");
        return data as { logs: GuestLoginLog[]; source: "supabase" | "local" };
      })
      .then((data) => {
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setSource(data.source);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "오류"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <RequireAdmin>
      <AppShell
        title="관리자 · 로그인 기록"
        action={
          <Button type="button" variant="secondary" onClick={refresh} disabled={loading}>
            새로고침
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-muted">
            일반 계정(<span className="font-medium text-foreground">guest</span>) 로그인
            기록입니다.
            {source ? (
              <>
                {" "}
                저장소:{" "}
                <span className="font-medium text-foreground">
                  {source === "supabase" ? "Supabase" : "로컬 파일"}
                </span>
              </>
            ) : null}
          </p>

          {loading ? (
            <p className="text-sm text-muted">불러오는 중…</p>
          ) : error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : logs.length === 0 ? (
            <div className="shadow-card rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm text-muted">아직 로그인 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="shadow-card overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-table-head text-xs text-muted">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">시각</th>
                      <th className="px-4 py-2.5 font-medium">계정</th>
                      <th className="px-4 py-2.5 font-medium">IP</th>
                      <th className="px-4 py-2.5 font-medium">User-Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((row) => (
                      <tr key={row.id} className="border-t border-border/70">
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-700">
                          {formatAt(row.loggedAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5">{row.username}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-700">
                          {row.ip ?? "—"}
                        </td>
                        <td className="max-w-md truncate px-4 py-2.5 text-xs text-muted" title={row.userAgent ?? undefined}>
                          {row.userAgent ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-border px-4 py-2 text-[11px] text-muted">
                최근 {logs.length}건
              </p>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAdmin>
  );
}
