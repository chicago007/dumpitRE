"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType } from "react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  LogIn,
  LogOut,
  MapPinned,
  MessageSquare,
  Settings2,
  Table2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/use-auth";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
};

const managementNav: NavItem[] = [
  { href: "/management", label: "전체 현황", icon: ClipboardList, exact: true },
  { href: "/management/sites", label: "사업장별(회차별)", icon: MapPinned },
  { href: "/management/interest", label: "분배금/만기일", icon: CalendarDays },
];

const workNav: NavItem[] = [
  { href: "/chat", label: "Q&A", icon: MessageSquare },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "상품/사업장", icon: Settings2, exact: true },
  { href: "/admin/portfolio", label: "사업장관리", icon: Table2 },
  { href: "/admin/sites", label: "전체 공정율", icon: Building2 },
  { href: "/upload", label: "업로드", icon: Upload },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-white font-medium text-foreground shadow-sm"
          : "text-muted hover:bg-white/60 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="leading-tight">{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAdmin, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="shrink-0 px-4 py-5">
        <Link href="/management" className="block">
          <p className="text-base font-semibold">Dumpit RE</p>
          <p className="text-xs text-muted">사업장 관리</p>
        </Link>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2">
        <div>
          <p className="mb-1 px-3 text-[11px] font-medium tracking-wide text-muted uppercase">
            관리현황
          </p>
          <div className="flex flex-col gap-0.5">
            {managementNav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          {workNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        {isAdmin ? (
          <div>
            <p className="mb-1 px-3 text-[11px] font-medium tracking-wide text-muted uppercase">
              관리자
            </p>
            <div className="flex flex-col gap-0.5">
              {adminNav.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        ) : null}
      </nav>
      <div className="shrink-0 space-y-2 border-t border-border px-4 py-4">
        {loading ? (
          <p className="text-xs text-muted">확인 중…</p>
        ) : user ? (
          <>
            <p className="text-xs text-muted">
              {user.role === "admin" ? "관리자 모드" : "일반 모드"}
            </p>
            <p className="text-sm">{user.name}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              로그아웃
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted">로그인 필요</p>
            <Link
              href="/login"
              className="flex items-center gap-1.5 text-xs text-accent hover:underline"
            >
              <LogIn className="h-3.5 w-3.5" />
              로그인
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
