import { NextResponse } from "next/server";
import { listSites } from "@/lib/data/repository";

export async function GET() {
  const sites = await listSites();
  return NextResponse.json(sites);
}
