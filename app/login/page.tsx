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
    <form
      onSubmit={submit}
      className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
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
