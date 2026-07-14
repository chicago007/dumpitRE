"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  MessageSquare,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
};

const topNav: NavItem[] = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
];

const managementNav: NavItem[] = [
  { href: "/management", label: "전체 현황", icon: ClipboardList, exact: true },
  { href: "/management/sites", label: "사업장별(회차별)", icon: MapPinned },
  { href: "/management/interest", label: "분배금/만기일", icon: CalendarDays },
];

const bottomNav: NavItem[] = [
  { href: "/sites", label: "공정율(사업장)", icon: Building2 },
  { href: "/upload", label: "업로드", icon: Upload },
  { href: "/chat", label: "Q&A", icon: MessageSquare },
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

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-4 py-5">
        <Link href="/management" className="block">
          <p className="text-base font-semibold">Dumpit RE</p>
          <p className="text-xs text-muted">사업장 관리</p>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-4 px-2">
        <div className="flex flex-col gap-0.5">
          {topNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

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
          {bottomNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>
      <div className="border-t border-border px-4 py-4">
        <p className="text-xs text-muted">관리자</p>
        <p className="text-sm">김○○</p>
      </div>
    </aside>
  );
}
