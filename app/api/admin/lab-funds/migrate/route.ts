import { NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/auth/session";
import {
  countSupabaseLabFunds,
  migrateLocalPortfolioToSupabase,
} from "@/lib/data/lab-portfolio";
import { isLabPortfolioDbConfigured } from "@/lib/data/supabase-lab-portfolio";
import { invalidateProductCache } from "@/lib/data/product-registry";

/** 로컬 .data/lab-portfolio.json → Supabase 일괄 이관 */
export async function POST() {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "관리자만 실행할 수 있습니다." }, { status: 403 });
  }

  if (!isLabPortfolioDbConfigured()) {
    return NextResponse.json(
      { error: "Supabase가 설정되지 않았습니다. 환경변수를 확인하세요." },
      { status: 400 }
    );
  }

  try {
    const result = await migrateLocalPortfolioToSupabase();
    if (result.ok) invalidateProductCache();
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "이관 실패";
    const missingTable =
      /relation .* does not exist|Could not find the table/i.test(message);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        hint: missingTable
          ? "Supabase SQL Editor에서 supabase/migrations/003_lab_portfolio.sql 을 먼저 실행하세요."
          : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return NextResponse.json({ error: "관리자만 조회할 수 있습니다." }, { status: 403 });
  }
  return NextResponse.json({
    supabaseConfigured: isLabPortfolioDbConfigured(),
    supabaseFundCount: await countSupabaseLabFunds(),
  });
}
