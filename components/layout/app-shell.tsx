"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

const SITE_NOTICE =
  "본 사이트는 iM증권 임직원 전용 정보 시스템입니다. 인가되지 않은 자의 접근 및 내부 정보의 무단 유출 시 관련 법령에 의해 처벌받을 수 있습니다.";

const SITE_USAGE_NOTE =
  "※ 과도한 조회 발생 시 접속이 차단될 수 있으므로, 원활한 이용을 위해 필요한 정보만 조회해 주시기 바랍니다.";

function isAdminSection(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/upload" ||
    pathname.startsWith("/upload/") ||
    pathname === "/chat" ||
    pathname.startsWith("/chat/")
  );
}

function SiteNotice() {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);

  const fit = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    for (const text of [textRef.current, noteRef.current]) {
      if (!text) continue;
      let size = text === textRef.current ? 12 : 11;
      text.style.fontSize = `${size}px`;
      while (size > 8 && text.scrollWidth > box.clientWidth) {
        size -= 0.25;
        text.style.fontSize = `${size}px`;
      }
    }
  }, []);

  useLayoutEffect(() => {
    fit();
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [fit]);

  return (
    <div ref={boxRef} className="min-w-0 flex-1 overflow-hidden">
      <p
        ref={textRef}
        className="whitespace-nowrap text-[12px] leading-tight text-red-600"
      >
        {SITE_NOTICE}
      </p>
      <p
        ref={noteRef}
        className="mt-0.5 whitespace-nowrap text-[11px] leading-tight text-red-600"
      >
        {SITE_USAGE_NOTE}
      </p>
    </div>
  );
}

interface AppShellProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function AppShell({ title, children, action }: AppShellProps) {
  const pathname = usePathname();
  const showNotice = !isAdminSection(pathname);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  return (
    <RequireAuth>
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
        <header className="z-20 flex min-h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2 shadow-card lg:gap-4 lg:px-6">
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
          <div className="flex min-w-0 flex-1 items-center gap-x-3">
            <h1 className="shrink-0 text-base font-semibold text-foreground">{title}</h1>
            {showNotice ? <SiteNotice /> : null}
          </div>
          {action ? (
            <div className="ml-auto flex shrink-0 items-center gap-2">{action}</div>
          ) : null}
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
    </RequireAuth>
  );
}
