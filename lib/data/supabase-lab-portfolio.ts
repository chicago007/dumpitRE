import { createAdminClient, isSupabaseServerConfigured } from "@/lib/supabase/admin";
import { deriveLabFundStatus, normalizeRateValue } from "@/lib/lab/portfolio-ui";
import type {
  LabFund,
  LabFundStatus,
  LabInterestPayment,
  LabPortfolioSnapshot,
  ProgressAttachment,
} from "@/lib/types";

type LabFundRow = {
  id: string;
  name: string;
  product_code: string | null;
  fund_name: string | null;
  fund_code: string | null;
  purchase_agency: string | null;
  setup_date: string | null;
  early_repayment_date: string | null;
  maturity_date: string | null;
  loan_maturity_date: string | null;
  repayment_date: string | null;
  setup_amount: number | null;
  balance: number | null;
  interest_rate: string | null;
  fee_rate: string | null;
  trust_type: string | null;
  trust_company: string | null;
  site_address: string | null;
  business_desc: string | null;
  developer: string | null;
  contractor: string | null;
  land_area: string | null;
  building_area: string | null;
  total_floor_area: string | null;
  building_scale: string | null;
  household_count: string | null;
  planned_progress_pct: number | null;
  actual_progress_pct: number | null;
  vs_plan: string | null;
  note: string | null;
  progress_comment: string | null;
  progress_attachments: ProgressAttachment[] | null;
  interest_payments: LabInterestPayment[] | null;
  status: LabFundStatus;
};

function db() {
  const client = createAdminClient();
  if (!client) throw new Error("Supabase not configured");
  return client;
}

function toDate(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function num(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

export function fundToRow(fund: LabFund): LabFundRow {
  return {
    id: fund.id,
    name: fund.name,
    product_code: fund.productCode,
    fund_name: fund.fundName,
    fund_code: fund.fundCode,
    purchase_agency: fund.purchaseAgency,
    setup_date: toDate(fund.setupDate),
    early_repayment_date: toDate(fund.earlyRepaymentDate),
    maturity_date: toDate(fund.maturityDate),
    loan_maturity_date: toDate(fund.loanMaturityDate),
    repayment_date: toDate(fund.repaymentDate),
    setup_amount: num(fund.setupAmount),
    balance: num(fund.balance),
    interest_rate: normalizeRateValue(fund.interestRate),
    fee_rate: normalizeRateValue(fund.feeRate),
    trust_type: fund.trustType,
    trust_company: fund.trustCompany,
    site_address: fund.siteAddress,
    business_desc: fund.businessDesc,
    developer: fund.developer,
    contractor: fund.contractor,
    land_area: fund.landArea,
    building_area: fund.buildingArea,
    total_floor_area: fund.totalFloorArea,
    building_scale: fund.buildingScale,
    household_count: fund.householdCount,
    planned_progress_pct: num(fund.plannedProgressPct),
    actual_progress_pct: num(fund.actualProgressPct),
    vs_plan: fund.vsPlan,
    note: fund.note,
    progress_comment: fund.progressComment,
    progress_attachments: fund.progressAttachments ?? [],
    interest_payments: fund.interestPayments ?? [],
    status: fund.status,
  };
}

export function rowToFund(row: LabFundRow): LabFund {
  const fund: LabFund = {
    id: row.id,
    name: row.name,
    productCode: row.product_code,
    fundName: row.fund_name,
    fundCode: row.fund_code,
    purchaseAgency: row.purchase_agency,
    setupDate: row.setup_date,
    earlyRepaymentDate: row.early_repayment_date ?? null,
    maturityDate: row.maturity_date,
    loanMaturityDate: row.loan_maturity_date,
    repaymentDate: row.repayment_date,
    setupAmount: row.setup_amount != null ? Number(row.setup_amount) : null,
    balance: row.balance != null ? Number(row.balance) : null,
    interestRate: normalizeRateValue(row.interest_rate),
    feeRate: normalizeRateValue(row.fee_rate),
    trustType: row.trust_type,
    trustCompany: row.trust_company,
    siteAddress: row.site_address,
    businessDesc: row.business_desc,
    developer: row.developer,
    contractor: row.contractor,
    landArea: row.land_area,
    buildingArea: row.building_area,
    totalFloorArea: row.total_floor_area,
    buildingScale: row.building_scale,
    householdCount: row.household_count,
    plannedProgressPct:
      row.planned_progress_pct != null ? Number(row.planned_progress_pct) : null,
    actualProgressPct:
      row.actual_progress_pct != null ? Number(row.actual_progress_pct) : null,
    vsPlan: row.vs_plan,
    note: row.note,
    progressComment: row.progress_comment,
    progressAttachments: Array.isArray(row.progress_attachments)
      ? row.progress_attachments
      : [],
    interestPayments: Array.isArray(row.interest_payments)
      ? row.interest_payments
      : [],
    status: row.status,
  };
  fund.status = deriveLabFundStatus(fund);
  return fund;
}

function recomputeStats(funds: LabFund[]): LabPortfolioSnapshot["stats"] {
  return {
    totalCount: funds.length,
    activeCount: funds.filter((f) => f.status === "active").length,
    repaidCount: funds.filter((f) => f.status === "repaid").length,
    totalSetupAmount: funds.reduce((s, f) => s + (f.setupAmount ?? 0), 0),
    totalBalance: funds.reduce((s, f) => s + (f.balance ?? 0), 0),
  };
}

export function isLabPortfolioDbConfigured(): boolean {
  return isSupabaseServerConfigured();
}

export async function sbGetDeletedNameKeys(): Promise<Set<string>> {
  const { data, error } = await db().from("lab_deleted_names").select("name_key");
  if (error) throw error;
  return new Set((data ?? []).map((r) => String(r.name_key)));
}

export async function sbRememberDeletedName(labName: string): Promise<void> {
  const key = labName.replace(/\s+/g, "").toLowerCase();
  if (!key) return;
  const { error } = await db().from("lab_deleted_names").upsert(
    { name_key: key, lab_name: labName, deleted_at: new Date().toISOString() },
    { onConflict: "name_key" }
  );
  if (error) throw error;
}

export async function sbRestoreDeletedName(labName: string): Promise<void> {
  const key = labName.replace(/\s+/g, "").toLowerCase();
  if (!key) return;
  const { error } = await db().from("lab_deleted_names").delete().eq("name_key", key);
  if (error) throw error;
}

export async function sbGetLabPortfolio(): Promise<LabPortfolioSnapshot | null> {
  const client = db();
  const [metaRes, fundsRes, deleted] = await Promise.all([
    client.from("lab_portfolio_meta").select("*").eq("id", 1).maybeSingle(),
    client.from("lab_funds").select("*").order("name"),
    sbGetDeletedNameKeys(),
  ]);
  if (metaRes.error) throw metaRes.error;
  if (fundsRes.error) throw fundsRes.error;

  const funds = ((fundsRes.data ?? []) as LabFundRow[])
    .map(rowToFund)
    .filter((f) => !deleted.has(f.name.replace(/\s+/g, "").toLowerCase()));

  if (funds.length === 0 && !metaRes.data) return null;

  return {
    uploadedAt: metaRes.data?.uploaded_at ?? new Date().toISOString(),
    fileName: metaRes.data?.file_name ?? "supabase",
    funds,
    stats: recomputeStats(funds),
  };
}

export async function sbReplaceLabPortfolio(
  next: LabPortfolioSnapshot
): Promise<LabPortfolioSnapshot> {
  const client = db();
  const rows = next.funds.map(fundToRow);
  const ids = rows.map((r) => r.id);

  const { error: metaError } = await client.from("lab_portfolio_meta").upsert({
    id: 1,
    uploaded_at: next.uploadedAt || new Date().toISOString(),
    file_name: next.fileName || "manual",
    updated_at: new Date().toISOString(),
  });
  if (metaError) throw metaError;

  if (ids.length > 0) {
    const { error: upsertError } = await client.from("lab_funds").upsert(rows, {
      onConflict: "id",
    });
    if (upsertError) throw upsertError;

    const { data: existing, error: existingError } = await client
      .from("lab_funds")
      .select("id");
    if (existingError) throw existingError;
    const keep = new Set(ids);
    const toDelete = (existing ?? [])
      .map((r) => String(r.id))
      .filter((id) => !keep.has(id));
    if (toDelete.length > 0) {
      const { error: deleteError } = await client
        .from("lab_funds")
        .delete()
        .in("id", toDelete);
      if (deleteError) throw deleteError;
    }
  } else {
    const { error: clearError } = await client
      .from("lab_funds")
      .delete()
      .neq("id", "");
    if (clearError) throw clearError;
  }

  return {
    ...next,
    stats: recomputeStats(next.funds),
  };
}

export async function sbUpsertLabFund(fund: LabFund): Promise<LabFund> {
  const row = fundToRow(fund);
  const { error } = await db().from("lab_funds").upsert(row, { onConflict: "id" });
  if (error) throw error;
  await db()
    .from("lab_portfolio_meta")
    .upsert({
      id: 1,
      updated_at: new Date().toISOString(),
    });
  return fund;
}

export async function sbDeleteLabFund(fundId: string): Promise<LabFund | null> {
  const { data, error } = await db()
    .from("lab_funds")
    .select("*")
    .eq("id", fundId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const fund = rowToFund(data as LabFundRow);
  const { error: deleteError } = await db().from("lab_funds").delete().eq("id", fundId);
  if (deleteError) throw deleteError;
  return fund;
}

export async function sbListAllLabFundsRaw(): Promise<LabFund[]> {
  const { data, error } = await db().from("lab_funds").select("*").order("name");
  if (error) throw error;
  return ((data ?? []) as LabFundRow[]).map(rowToFund);
}
