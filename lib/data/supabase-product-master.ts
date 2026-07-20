import { createAdminClient, isSupabaseServerConfigured } from "@/lib/supabase/admin";
import type { ProductMaster } from "@/lib/types";

type ProductMasterDbRow = {
  id: string;
  lab_name: string;
  fund_name: string | null;
  site_address: string;
  site_name: string | null;
  aliases: string[] | null;
  site_id: string | null;
  contract_amount: number | null;
  notes: string | null;
  has_proposal: boolean;
  created_at: string;
  updated_at: string;
};

function db() {
  const client = createAdminClient();
  if (!client) throw new Error("Supabase admin client not configured");
  return client;
}

export function isProductMasterDbConfigured(): boolean {
  return isSupabaseServerConfigured();
}

function rowToProduct(row: ProductMasterDbRow): ProductMaster {
  return {
    id: row.id,
    labName: row.lab_name ?? "",
    fundName: row.fund_name,
    siteAddress: row.site_address ?? "",
    siteName: row.site_name,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    siteId: row.site_id,
    contractAmount: row.contract_amount != null ? Number(row.contract_amount) : null,
    notes: row.notes,
    hasProposal: row.has_proposal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function productToRow(product: ProductMaster): ProductMasterDbRow {
  return {
    id: product.id,
    lab_name: product.labName,
    fund_name: product.fundName,
    site_address: product.siteAddress,
    site_name: product.siteName,
    aliases: product.aliases ?? [],
    site_id: product.siteId,
    contract_amount: product.contractAmount,
    notes: product.notes,
    has_proposal: product.hasProposal === true,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  };
}

export async function sbListProductMaster(): Promise<ProductMaster[]> {
  const { data, error } = await db()
    .from("product_master")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ProductMasterDbRow[]).map(rowToProduct);
}

export async function sbUpsertProductMaster(product: ProductMaster): Promise<ProductMaster> {
  const payload = productToRow({
    ...product,
    updatedAt: new Date().toISOString(),
  });
  const { data, error } = await db()
    .from("product_master")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return rowToProduct(data as ProductMasterDbRow);
}

export async function sbBulkUpsertProductMaster(products: ProductMaster[]): Promise<void> {
  if (!products.length) return;
  const payload = products.map((p) => productToRow(p));
  const { error } = await db().from("product_master").upsert(payload, { onConflict: "id" });
  if (error) throw error;
}

export async function sbDeleteProductMaster(id: string): Promise<void> {
  const { error } = await db().from("product_master").delete().eq("id", id);
  if (error) throw error;
}
