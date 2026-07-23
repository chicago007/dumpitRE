"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LabProgressApplyResult, ReviewQueueItem } from "@/lib/types";

const PROGRESS_PENDING_KEY = "dumpitre_pending_progress_match_v1";
const STALE_PENDING_KEY = "dumpitre_pending_progress_stale_v1";

const kindLabel: Record<ReviewQueueItem["kind"], string> = {
  progress_match: "공정 매칭",
  progress_stale: "구 자료 덮어쓰기",
  progress_extract_failed: "공정 추출 실패",
  proposal_register: "제안서 등록",
};

function kindVariant(kind: ReviewQueueItem["kind"]) {
  if (kind === "proposal_register") return "default" as const;
  if (kind === "progress_extract_failed") return "warning" as const;
  return "default" as const;
}

function toProgressResult(item: ReviewQueueItem): LabProgressApplyResult | null {
  const payload = item.payload ?? {};
  const row = payload.row as LabProgressApplyResult["row"];
  if (!row) return null;
  return {
    action:
      (payload.action as LabProgressApplyResult["action"]) ??
      (item.kind === "progress_stale" ? "stale" : "unmatched"),
    message: item.message,
    row,
    existing: (payload.existing as LabProgressApplyResult["existing"]) ?? null,
    matchCandidates:
      (payload.matchCandidates as LabProgressApplyResult["matchCandidates"]) ??
      undefined,
    needsConfirmation: true,
    suggestedLabName:
      (payload.suggestedLabName as string | null | undefined) ?? null,
  };
}

export default function AdminReviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/review-queue?status=pending", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "불러오기 실패");
        return data as ReviewQueueItem[];
      })
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => setError(err instanceof Error ? err.message : "오류"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function dismiss(id: string) {
    setMessage(null);
    const res = await fetch("/api/admin/review-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "dismissed" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "처리 실패");
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    setMessage("대기 항목을 보관했습니다.");
  }

  function handleProcess(item: ReviewQueueItem) {
    if (item.kind === "proposal_register") {
      const q = item.documentId
        ? `?documentId=${encodeURIComponent(item.documentId)}&reviewId=${encodeURIComponent(item.id)}`
        : `?reviewId=${encodeURIComponent(item.id)}`;
      router.push(`/upload${q}`);
      return;
    }

    const result = toProgressResult(item);
    if (!result) {
      setMessage("대기 항목에 공정 데이터가 없어 업로드 화면으로만 이동합니다.");
      router.push("/upload?focus=progress");
      return;
    }

    try {
      if (item.kind === "progress_stale") {
        sessionStorage.setItem(STALE_PENDING_KEY, JSON.stringify(result));
        sessionStorage.removeItem(PROGRESS_PENDING_KEY);
      } else {
        sessionStorage.setItem(PROGRESS_PENDING_KEY, JSON.stringify([result]));
        sessionStorage.removeItem(STALE_PENDING_KEY);
      }
    } catch {
      /* ignore */
    }

    router.push(
      `/upload?reviewId=${encodeURIComponent(item.id)}&focus=progress`
    );
  }

  return (
    <RequireAdmin>
      <AppShell
        title="관리자 · 검토 대기함"
        action={
          <Link
            href="/admin/progress"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-card hover:bg-accent/5"
          >
            공정율 현황
          </Link>
        }
      >
        <div className="mx-auto max-w-4xl space-y-4">
          <p className="text-xs text-muted">
            업로드 후 수동 확인·등록이 필요한 항목입니다. 「처리하기」로 업로드 화면의
            매칭·덮어쓰기 UI를 엽니다.
          </p>

          {message ? <p className="text-xs text-accent">{message}</p> : null}
          {loading ? (
            <p className="text-sm text-muted">불러오는 중…</p>
          ) : error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : items.length === 0 ? (
            <div className="shadow-card rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm text-muted">대기 중인 검토 항목이 없습니다.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="shadow-card rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={kindVariant(item.kind)}>
                          {kindLabel[item.kind]}
                        </Badge>
                        <span className="text-xs text-muted">
                          {new Date(item.createdAt).toLocaleString("ko-KR")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium">{item.fileName}</p>
                      <p className="mt-1 text-xs text-muted">{item.message}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        className="h-8 text-xs"
                        onClick={() => handleProcess(item)}
                      >
                        처리하기
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => void dismiss(item.id)}
                      >
                        보관
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AppShell>
    </RequireAdmin>
  );
}
