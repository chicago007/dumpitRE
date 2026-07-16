"use client";

import { useCallback, useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

interface AppShellProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function AppShell({ title, children, action }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  return (
    <div className="flex h-dvh overflow-hidden">
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/35 lg:hidden"
          aria-label="메뉴 닫기"
          onClick={closeMobileNav}
        />
      ) : null}

      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={closeMobileNav} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 shadow-card lg:gap-4 lg:px-6">
          <button
            type="button"
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted lg:hidden",
              "hover:bg-neutral-50 hover:text-foreground"
            )}
            aria-label={mobileNavOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <h1 className="min-w-0 truncate text-base font-semibold text-foreground">{title}</h1>
          {action ? (
            <div className="ml-auto flex shrink-0 items-center gap-2">{action}</div>
          ) : null}
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
