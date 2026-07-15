import { NextResponse } from "next/server";
import { getDocuments } from "@/lib/data/seed";
import { isSupabaseServerConfigured } from "@/lib/supabase/admin";
import * as sbRepo from "@/lib/data/supabase-repository";

/** 업로드 큐는 로컬을 우선. Supabase는 짧게만 시도 */
export async function GET() {
  const local = getDocuments();

  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(local);
  }

  try {
    const remote = await Promise.race([
      sbRepo.sbFetchDocuments(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("documents fetch timeout")), 2500)
      ),
    ]);
    // remote 우선, 로컬에만 있는 최근 업로드도 합침
    const remoteIds = new Set(remote.map((d) => d.id));
    const merged = [...remote, ...local.filter((d) => !remoteIds.has(d.id))];
    return NextResponse.json(merged);
  } catch {
    return NextResponse.json(local);
  }
}
