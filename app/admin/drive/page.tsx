"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Button } from "@/components/ui/button";

type Status = {
  oauthClientConfigured: boolean;
  oauthConnected: boolean;
  driveReady: boolean;
  authMode: "oauth" | "service_account" | "none";
  rootFolderId: string | null;
  email: string | null;
  updatedAt: string | null;
};

export default function AdminDrivePage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch("/api/google-drive/status")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const params = new URLSearchParams(window.location.search);
    if (params.get("ok")) {
      setMessage(
        params.get("email")
          ? `Google Drive 연결 완료 (${params.get("email")})`
          : "Google Drive 연결 완료"
      );
      window.history.replaceState({}, "", "/admin/drive");
    } else if (params.get("error")) {
      setMessage(`연결 실패: ${params.get("error")}`);
      window.history.replaceState({}, "", "/admin/drive");
    }
  }, [refresh]);

  async function disconnect() {
    if (!confirm("Google Drive 연결을 해제할까요?")) return;
    await fetch("/api/google-drive/status", { method: "DELETE" });
    setMessage("연결이 해제되었습니다.");
    refresh();
  }

  return (
    <RequireAdmin>
      <AppShell title="Google Drive 연결">
        <div className="mx-auto max-w-2xl space-y-5">
          <section className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="text-sm font-semibold text-foreground">내 드라이브(OAuth)</h2>
            <p className="mt-1 text-xs text-muted">
              개인 Gmail의 dumpitRE 폴더에 업로드하려면 Google 계정으로 한 번 연결하세요.
              서비스 계정(공유 드라이브) 방식 대신 사용합니다.
            </p>

            {loading ? (
              <p className="mt-4 text-sm text-muted">상태 확인 중…</p>
            ) : status ? (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">OAuth 클라이언트</dt>
                  <dd>{status.oauthClientConfigured ? "설정됨" : "미설정 (.env)"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">계정 연결</dt>
                  <dd>
                    {status.oauthConnected
                      ? status.email
                        ? `연결됨 (${status.email})`
                        : "연결됨"
                      : "미연결"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">업로드 모드</dt>
                  <dd>
                    {status.authMode === "oauth"
                      ? "OAuth (내 드라이브)"
                      : status.authMode === "service_account"
                        ? "서비스 계정"
                        : "없음"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">루트 폴더 ID</dt>
                  <dd className="truncate font-mono text-xs">
                    {status.rootFolderId ?? "미설정"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Drive 준비</dt>
                  <dd className={status.driveReady ? "text-accent" : "text-danger"}>
                    {status.driveReady ? "업로드 가능" : "불가"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-danger">상태를 불러오지 못했습니다.</p>
            )}

            {message ? <p className="mt-3 text-xs text-muted">{message}</p> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={!status?.oauthClientConfigured}
                onClick={() => {
                  window.location.href = "/api/google-drive/oauth/start";
                }}
              >
                Google 계정 연결
              </Button>
              {status?.oauthConnected ? (
                <Button type="button" variant="secondary" onClick={() => void disconnect()}>
                  연결 해제
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={refresh}>
                새로고침
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-dashed border-border bg-neutral-50/80 p-5 text-xs text-muted">
            <p className="font-medium text-foreground">최초 1회 설정</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>
                Google Cloud Console → API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID
                (웹 애플리케이션) 생성
              </li>
              <li>
                승인된 리디렉션 URI에{" "}
                <code className="rounded bg-white px-1">
                  http://localhost:3000/api/google-drive/oauth/callback
                </code>{" "}
                추가
              </li>
              <li>
                .env.local 에{" "}
                <code className="rounded bg-white px-1">GOOGLE_OAUTH_CLIENT_ID</code> /{" "}
                <code className="rounded bg-white px-1">GOOGLE_OAUTH_CLIENT_SECRET</code> 저장
              </li>
              <li>
                <code className="rounded bg-white px-1">GOOGLE_DRIVE_ROOT_FOLDER_ID</code> 는 기존
                dumpitRE 폴더 ID 유지
              </li>
              <li>위 버튼으로 Google 로그인 후 Drive 권한 허용</li>
            </ol>
          </section>
        </div>
      </AppShell>
    </RequireAdmin>
  );
}
