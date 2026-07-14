import { NextResponse } from "next/server";
import { getLabPortfolio } from "@/lib/data/lab-portfolio";

export async function GET() {
  const portfolio = getLabPortfolio();
  return NextResponse.json(portfolio);
}
