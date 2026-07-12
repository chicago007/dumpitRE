import { NextRequest, NextResponse } from "next/server";
import { queryChat } from "@/lib/data/repository";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const question = body.question as string;
  const siteId = (body.siteId as string) || null;
  const sessionId = (body.sessionId as string) || null;

  if (!question?.trim()) {
    return NextResponse.json({ error: "question required" }, { status: 400 });
  }

  const result = await queryChat(question.trim(), { siteId, sessionId });
  return NextResponse.json(result);
}
