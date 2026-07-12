"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  MessageSquare,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/sites", label: "사업장", icon: Building2 },
  { href: "/upload", label: "업로드", icon: Upload },
  { href: "/chat", label: "Q&A", icon: MessageSquare },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-4 py-5">
        <p className="text-base font-semibold">Dumpit RE</p>
        <p className="text-xs text-muted">사업장 관리</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-white font-medium text-foreground shadow-sm"
                  : "text-muted hover:bg-white/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-4 py-4">
        <p className="text-xs text-muted">관리자</p>
        <p className="text-sm">김○○</p>
      </div>
    </aside>
  );
}
