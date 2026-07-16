import { NextResponse } from "next/server";
import { listSites } from "@/lib/data/repository";

export async function GET() {
  try {
    const sites = await listSites();
    return NextResponse.json(sites);
  } catch (err) {
    console.error("[api/sites]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "사업장 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
