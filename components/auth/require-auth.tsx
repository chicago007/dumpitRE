"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/use-auth";

/** 로그인 필수 (페이지 클라이언트 가드) */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [loading, user, router]);

  if (loading && !user) {
    return <p className="p-6 text-sm text-muted">로그인 확인 중…</p>;
  }
  if (!user) {
    return <p className="p-6 text-sm text-muted">로그인 확인 중…</p>;
  }
  return <>{children}</>;
}
