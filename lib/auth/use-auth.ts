"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@/lib/auth/session";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  return {
    user,
    loading,
    isAdmin: user?.role === "admin",
    canViewFullOverview: user?.role === "admin" || user?.id === "u-wrap",
    isLoggedIn: Boolean(user),
    refresh,
    logout,
  };
}
