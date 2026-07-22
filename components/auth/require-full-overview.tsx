"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/use-auth";

/** 전체 현황 제한 서브메뉴 — 관리자 또는 wrap */
export function RequireFullOverview({ children }: { children: React.ReactNode }) {
  const { user, loading, canViewFullOverview } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!canViewFullOverview) {
      router.replace("/management");
    }
  }, [loading, user, canViewFullOverview, router]);

  if (loading && !user) {
    return <p className="p-6 text-sm text-muted">권한 확인 중…</p>;
  }
  if (!canViewFullOverview) {
    return <p className="p-6 text-sm text-muted">권한 확인 중…</p>;
  }
  return <>{children}</>;
}
