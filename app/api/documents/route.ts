import { NextResponse } from "next/server";
import { fetchDocuments } from "@/lib/data/repository";

export async function GET() {
  const docs = await fetchDocuments();
  return NextResponse.json(docs);
}
