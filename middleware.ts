import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, parseSessionCookie } from "@/lib/auth/session";

function isPublicPath(pathname: string) {
  if (pathname === "/login") return true;
  if (pathname === "/api/auth/login") return true;
  if (pathname === "/api/auth/me") return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (/\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml)$/i.test(pathname)) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const user = parseSessionCookie(req.cookies.get(AUTH_COOKIE)?.value);
  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 전체 현황 일부 메뉴: 관리자만
  const adminOnlyPaths = [
    "/management/fee-trend",
    "/management/setup-repayment",
    "/management/by-entity",
    "/management/by-region",
  ];
  if (
    adminOnlyPaths.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    ) &&
    user.role !== "admin"
  ) {
    return NextResponse.redirect(new URL("/management", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
