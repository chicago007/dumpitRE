"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { ComponentType } from "react";
import {
  BarChart3,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Coins,
  Inbox,
  LogIn,
  LogOut,
  Map,
  MapPinned,
  MessageSquare,
  Percent,
  Settings2,
  Table2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/use-auth";
import { APP_VERSION } from "@/lib/version";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
};

const overviewSubNav: NavItem[] = [
  { href: "/management/sites", label: "사업장별(회차별)", icon: MapPinned },
  { href: "/management/setup-repayment", label: "설정·상환 추이", icon: BarChart3 },
  { href: "/management/fee-trend", label: "수수료 추이", icon: Percent },
  { href: "/management/by-entity", label: "업체별 현황", icon: Building2 },
  { href: "/management/by-region", label: "지역별 현황", icon: Map },
];

/** 전체 현황 서브메뉴 중 관리자만 표시 */
const ADMIN_ONLY_OVERVIEW = new Set([
  "/management/setup-repayment",
  "/management/fee-trend",
  "/management/by-entity",
  "/management/by-region",
]);

const interestSubNav: NavItem[] = [
  { href: "/management/interest/maturity", label: "만기 캘린더", icon: CalendarClock },
  { href: "/management/interest/schedule", label: "이자 분배 스케줄", icon: Coins },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "상품/사업장", icon: Settings2, exact: true },
  { href: "/admin/portfolio", label: "사업장관리", icon: Table2 },
  { href: "/admin/progress", label: "공정율 현황", icon: ClipboardList },
  { href: "/admin/review", label: "검토 대기함", icon: Inbox },
  { href: "/admin/login-logs", label: "로그인 기록", icon: LogIn },
  { href: "/upload", label: "업로드", icon: Upload },
  { href: "/chat", label: "Q&A", icon: MessageSquare },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({
  item,
  pathname,
  compact,
}: {
  item: NavItem;
  pathname: string;
  compact?: boolean;
}) {
  const active = isActive(pathname, item);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center rounded-xl px-3 transition-colors",
        compact ? "gap-2 py-1.5 text-[12px]" : "gap-2.5 py-2 text-sm",
        active
          ? "bg-white font-medium text-sidebar-foreground shadow-sm"
          : "text-sidebar-muted hover:bg-white/45 hover:text-sidebar-foreground"
      )}
    >
      <Icon
        className={cn(
          "shrink-0",
          compact ? "h-3.5 w-3.5" : "h-4 w-4",
          active && "text-sidebar-active"
        )}
      />
      <span className="leading-tight">{item.label}</span>
    </Link>
  );
}

function NavSubLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname === item.href;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-2 text-[13px] transition-colors",
        active
          ? "bg-white font-medium text-sidebar-foreground shadow-sm"
          : "text-sidebar-muted hover:bg-white/45 hover:text-sidebar-foreground"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", active && "text-sidebar-active")} />
      <span className="leading-tight">{item.label}</span>
    </Link>
  );
}

function OverviewNavGroup({
  pathname,
  isAdmin,
}: {
  pathname: string;
  isAdmin: boolean;
}) {
  const visibleSubNav = overviewSubNav.filter(
    (item) => !ADMIN_ONLY_OVERVIEW.has(item.href) || isAdmin
  );
  const parentActive =
    pathname === "/management" ||
    visibleSubNav.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const Icon = ClipboardList;

  return (
    <div className="space-y-0.5">
      <Link
        href="/management"
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
          parentActive
            ? "bg-white font-medium text-sidebar-foreground shadow-sm"
            : "text-sidebar-muted hover:bg-white/45 hover:text-sidebar-foreground"
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", parentActive && "text-sidebar-active")} />
        <span className="leading-tight">전체 현황</span>
      </Link>
      <div className="ml-5 flex flex-col gap-0.5 border-l border-im-beige/70 py-0.5 pl-2">
        {visibleSubNav.map((item) => (
          <NavSubLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </div>
  );
}

function InterestNavGroup({ pathname }: { pathname: string }) {
  const parentActive = pathname === "/management/interest";
  const Icon = CalendarDays;

  return (
    <div className="space-y-0.5">
      <Link
        href="/management/interest"
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
          parentActive
            ? "bg-white font-medium text-sidebar-foreground shadow-sm"
            : "text-sidebar-muted hover:bg-white/45 hover:text-sidebar-foreground"
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", parentActive && "text-sidebar-active")} />
        <span className="leading-tight">분배금/만기일</span>
      </Link>
      <div className="ml-5 flex flex-col gap-0.5 border-l border-im-beige/70 py-0.5 pl-2">
        {interestSubNav.map((item) => (
          <NavSubLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </div>
  );
}

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAdmin, logout } = useAuth();
  const onMobileCloseRef = useRef(onMobileClose);
  onMobileCloseRef.current = onMobileClose;

  useEffect(() => {
    onMobileCloseRef.current?.();
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "flex h-full w-[220px] shrink-0 flex-col border-r border-im-beige/60 bg-sidebar text-sidebar-foreground",
        "fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
    >
      <div className="shrink-0 border-b border-im-beige/50 px-4 py-5">
        <Link href="/management" className="block">
          <p className="text-xs font-semibold tracking-tight text-im-gray">
            LH/SH/GH 매입약정
          </p>
          <p className="mt-0.5 flex items-baseline gap-1 whitespace-nowrap">
            <span className="text-accent text-[15px] font-bold tracking-tight">
              부동산랩 사업장관리
            </span>
            <span className="shrink-0 text-[11px] font-medium text-slate-400">{APP_VERSION}</span>
          </p>
        </Link>
        <div className="mt-3 h-1 w-12 rounded-full bg-accent opacity-80" aria-hidden />
      </div>
      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
        <div className="flex flex-col gap-0.5">
          <OverviewNavGroup pathname={pathname} isAdmin={isAdmin} />
          <InterestNavGroup pathname={pathname} />
        </div>

        {isAdmin ? (
          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold tracking-wide text-sidebar-muted uppercase">
              관리자
            </p>
            <div className="flex flex-col gap-0.5">
              {adminNav.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} compact />
              ))}
            </div>
          </div>
        ) : null}
      </nav>
      <div className="shrink-0 space-y-2 border-t border-im-beige/50 px-4 py-4">
        {loading ? (
          <p className="text-xs text-sidebar-muted">확인 중…</p>
        ) : user ? (
          <>
            <p className="text-xs text-sidebar-muted">
              {user.role === "admin" ? "관리자 모드" : "일반 모드"}
            </p>
            <p className="text-sm font-medium text-sidebar-foreground">{user.name}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-sidebar-muted hover:text-sidebar-active"
            >
              <LogOut className="h-3.5 w-3.5" />
              로그아웃
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-sidebar-muted">로그인 필요</p>
            <Link
              href="/login"
              className="flex items-center gap-1.5 text-xs text-sidebar-active hover:underline"
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
