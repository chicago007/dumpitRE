#!/usr/bin/env node
/**
 * Apply 003_lab_portfolio.sql via Supabase Management API is not available here.
 * This script upserts local .data/lab-portfolio.json into Supabase after tables exist.
 *
 * Usage: node --env-file=.env.local scripts/migrate-lab-portfolio.cjs
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const root = path.join(__dirname, "..");
const dataPath = path.join(root, ".data", "lab-portfolio.json");
const sqlPath = path.join(root, "supabase/migrations/003_lab_portfolio.sql");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!fs.existsSync(dataPath)) {
  console.error("No local file:", dataPath);
  process.exit(1);
}

const portfolio = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const funds = portfolio.funds || [];
console.log(`Local funds: ${funds.length} (${portfolio.fileName})`);

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function toDate(v) {
  if (!v || typeof v !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
}

function toRow(f) {
  return {
    id: f.id,
    name: f.name,
    product_code: f.productCode ?? null,
    fund_name: f.fundName ?? null,
    fund_code: f.fundCode ?? null,
    purchase_agency: f.purchaseAgency ?? null,
    setup_date: toDate(f.setupDate),
    maturity_date: toDate(f.maturityDate),
    loan_maturity_date: toDate(f.loanMaturityDate),
    repayment_date: toDate(f.repaymentDate),
    setup_amount: f.setupAmount ?? null,
    balance: f.balance ?? null,
    interest_rate: f.interestRate != null ? String(f.interestRate) : null,
    fee_rate: f.feeRate != null ? String(f.feeRate) : null,
    trust_type: f.trustType ?? null,
    trust_company: f.trustCompany ?? null,
    site_address: f.siteAddress ?? null,
    business_desc: f.businessDesc ?? null,
    developer: f.developer ?? null,
    contractor: f.contractor ?? null,
    land_area: f.landArea ?? null,
    building_area: f.buildingArea ?? null,
    total_floor_area: f.totalFloorArea ?? null,
    building_scale: f.buildingScale ?? null,
    household_count: f.householdCount ?? null,
    planned_progress_pct: f.plannedProgressPct ?? null,
    actual_progress_pct: f.actualProgressPct ?? null,
    vs_plan: f.vsPlan ?? null,
    note: f.note ?? null,
    progress_comment: f.progressComment ?? null,
    interest_payments: f.interestPayments ?? [],
    status: f.status || "active",
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  const probe = await sb.from("lab_funds").select("id").limit(1);
  if (probe.error) {
    console.error("\nTable missing or inaccessible:", probe.error.message);
    console.error("\n1) Open Supabase SQL Editor");
    console.error("2) Run file:", sqlPath);
    console.error("3) Re-run this script\n");
    process.exit(1);
  }

  const rows = funds.map(toRow);
  const { error: metaErr } = await sb.from("lab_portfolio_meta").upsert({
    id: 1,
    uploaded_at: portfolio.uploadedAt || new Date().toISOString(),
    file_name: portfolio.fileName || "migrated",
    updated_at: new Date().toISOString(),
  });
  if (metaErr) throw metaErr;

  // upsert in chunks
  const chunk = 50;
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const { error } = await sb.from("lab_funds").upsert(part, { onConflict: "id" });
    if (error) throw error;
    console.log(`Upserted ${Math.min(i + chunk, rows.length)} / ${rows.length}`);
  }

  const { data: existing, error: listErr } = await sb.from("lab_funds").select("id");
  if (listErr) throw listErr;
  const keep = new Set(rows.map((r) => r.id));
  const extra = (existing || []).map((r) => r.id).filter((id) => !keep.has(id));
  if (extra.length) {
    const { error } = await sb.from("lab_funds").delete().in("id", extra);
    if (error) throw error;
    console.log(`Removed stale rows: ${extra.length}`);
  }

  console.log(`Done. Migrated ${rows.length} funds to Supabase.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
