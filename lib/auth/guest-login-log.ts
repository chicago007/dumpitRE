import fs from "fs";
import path from "path";
import { createAdminClient, isSupabaseServerConfigured } from "@/lib/supabase/admin";

export type GuestLoginLog = {
  id: string;
  username: string;
  userId: string;
  ip: string | null;
  userAgent: string | null;
  loggedAt: string;
};

const LOCAL_PATH = path.join(process.cwd(), ".data", "guest-login-logs.json");

function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || null;
}

function appendLocal(entry: GuestLoginLog) {
  try {
    fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
    let list: GuestLoginLog[] = [];
    if (fs.existsSync(LOCAL_PATH)) {
      list = JSON.parse(fs.readFileSync(LOCAL_PATH, "utf8")) as GuestLoginLog[];
      if (!Array.isArray(list)) list = [];
    }
    list.unshift(entry);
    // 로컬은 최근 2000건만 유지
    if (list.length > 2000) list = list.slice(0, 2000);
    fs.writeFileSync(LOCAL_PATH, JSON.stringify(list, null, 2));
  } catch (err) {
    console.warn("[guest-login] local persist failed:", err);
  }
}

/** guest(일반) 계정 로그인 성공 시 호출 */
export async function recordGuestLogin(opts: {
  userId: string;
  username?: string;
  headers: Headers;
}): Promise<void> {
  const entry: GuestLoginLog = {
    id: crypto.randomUUID(),
    username: opts.username ?? "guest",
    userId: opts.userId,
    ip: clientIp(opts.headers),
    userAgent: opts.headers.get("user-agent"),
    loggedAt: new Date().toISOString(),
  };

  if (isSupabaseServerConfigured()) {
    const sb = createAdminClient();
    if (sb) {
      const { error } = await sb.from("guest_login_logs").insert({
        id: entry.id,
        username: entry.username,
        user_id: entry.userId,
        ip: entry.ip,
        user_agent: entry.userAgent,
        logged_at: entry.loggedAt,
      });
      if (!error) return;
      console.warn("[guest-login] supabase insert failed, falling back to local:", error.message);
    }
  }

  appendLocal(entry);
}

function readLocal(limit: number): GuestLoginLog[] {
  try {
    if (!fs.existsSync(LOCAL_PATH)) return [];
    const list = JSON.parse(fs.readFileSync(LOCAL_PATH, "utf8")) as GuestLoginLog[];
    if (!Array.isArray(list)) return [];
    return list.slice(0, limit);
  } catch {
    return [];
  }
}

function mapRow(row: {
  id: string;
  username: string;
  user_id: string;
  ip: string | null;
  user_agent: string | null;
  logged_at: string;
}): GuestLoginLog {
  return {
    id: row.id,
    username: row.username,
    userId: row.user_id,
    ip: row.ip,
    userAgent: row.user_agent,
    loggedAt: row.logged_at,
  };
}

/** 최근 guest 로그인 기록 (관리자 조회용) */
export async function listGuestLoginLogs(limit = 200): Promise<{
  logs: GuestLoginLog[];
  source: "supabase" | "local";
}> {
  const capped = Math.min(Math.max(limit, 1), 500);

  if (isSupabaseServerConfigured()) {
    const sb = createAdminClient();
    if (sb) {
      const { data, error } = await sb
        .from("guest_login_logs")
        .select("id, username, user_id, ip, user_agent, logged_at")
        .order("logged_at", { ascending: false })
        .limit(capped);
      if (!error) {
        return {
          logs: (data ?? []).map(mapRow),
          source: "supabase",
        };
      }
      console.warn("[guest-login] supabase list failed, falling back to local:", error.message);
    }
  }

  return { logs: readLocal(capped), source: "local" };
}
