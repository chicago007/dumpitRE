"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/use-auth";

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!isAdmin) {
      router.replace("/management");
    }
  }, [loading, user, isAdmin, router]);

  // 최초 확인 전에는 로딩만. 이후 loading 깜빡임으로 children(모달 state)이 언마운트되지 않게 함
  if (loading && !user) {
    return <p className="p-6 text-sm text-muted">관리자 권한 확인 중…</p>;
  }
  if (!isAdmin) {
    return <p className="p-6 text-sm text-muted">관리자 권한 확인 중…</p>;
  }
  return <>{children}</>;
}
