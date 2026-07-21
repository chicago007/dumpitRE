import { cookies } from "next/headers";

export type UserRole = "admin" | "user";

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
}

const COOKIE = "dumpit_auth";

/** 고정 계정 2개 (관리자 / 일반). env로 비밀번호만 덮어쓸 수 있음. */
const USERS: Record<string, { password: string; user: AuthUser }> = {
  admin: {
    password: process.env.DUMPIT_ADMIN_PASSWORD ?? "imrwap0700",
    user: { id: "u-admin", name: "관리자", role: "admin" },
  },
  guest: {
    password: process.env.DUMPIT_GUEST_PASSWORD ?? "0700",
    user: { id: "u-guest", name: "guest", role: "user" },
  },
};

export function authenticate(username: string, password: string): AuthUser | null {
  const row = USERS[username.trim().toLowerCase()];
  if (!row || row.password !== password) return null;
  return row.user;
}

function encode(user: AuthUser): string {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

function decode(raw: string | undefined): AuthUser | null {
  if (!raw) return null;
  try {
    const user = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as AuthUser;
    if (user.role !== "admin" && user.role !== "user") return null;
    return user;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  return decode(jar.get(COOKIE)?.value);
}

export async function setSessionUser(user: AuthUser): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, encode(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function isGuestUser(user: AuthUser | null | undefined): boolean {
  return user?.role === "user";
}
