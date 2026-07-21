"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "로그인 실패");
        return;
      }
      const next = search.get("next") || "/management";
      router.replace(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-4">
      <aside className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs leading-relaxed text-red-700">
        <p>
          본 웹사이트는 iM증권 임직원의 업무 및 정보 제공을 위해 작성된 비공개
          시스템입니다. 인가받지 않은 외부인의 접근을 금하며, 본 사이트의 정보를
          무단으로 유출, 복제, 배포하는 경우 무단 침해 및 정보유출로 간주되어
          관련 법령에 따라 민·형사상 엄중한 법적 조치가 취해집니다.
        </p>
        <p className="mt-2">
          ※ 단시간 내 과도한 조회 발생 시 시스템 안정성을 위해 접속이 자동
          차단되거나 중단될 수 있습니다. 원활한 시스템 이용을 위해 필요한
          정보만 조회해 주시기 바랍니다.
        </p>
      </aside>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        <div>
          <h1 className="text-lg font-semibold">Dumpit RE 로그인</h1>
          <p className="mt-1 text-xs text-muted">임직원 전용 정보 시스템</p>
        </div>
        <label className="block text-xs">
          <span className="text-muted">아이디</span>
          <input
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted">비밀번호</span>
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "로그인 중…" : "로그인"}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Suspense fallback={<p className="text-sm text-muted">로딩…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
