import { getDocuments, sites } from "@/lib/data/seed";
import { getLabPortfolio, isLabDeleted } from "@/lib/data/lab-portfolio";
import {
  isProductMasterDbConfigured,
  sbBulkUpsertProductMaster,
  sbDeleteProductMaster,
  sbListProductMaster,
  sbUpsertProductMaster,
} from "@/lib/data/supabase-product-master";
import {
  isDeletedAddressHint,
  isDeletedLabName,
  isProductDeleted,
  isSiteDeleted,
  rememberDeletedMaster,
} from "@/lib/data/deleted-masters";
import { extractLabNumber } from "@/lib/analyzers/proposal";
import type { LabPortfolioSnapshot, ProductMaster } from "@/lib/types";

let products: ProductMaster[] | null = null;

function seedProducts(portfolio: LabPortfolioSnapshot | null): ProductMaster[] {
  const fromSites: ProductMaster[] = sites
    .filter((s) => !isSiteDeleted(s.id) && !isProductDeleted(`prod-${s.id}`))
    .map((s) => ({
      id: `prod-${s.id}`,
      labName: "",
      fundName: null,
      siteAddress: s.address,
      siteName: s.name,
      aliases: [s.name, s.address, s.code].filter(Boolean) as string[],
      siteId: s.id,
      contractAmount: s.contractAmount,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

  // Special known mappings
  const gildong = fromSites.find((p) => p.siteId === "site-gildong");
  if (gildong) {
    gildong.aliases.push("길동", "강동구", "IM_SH", "im_sh");
    gildong.siteName = "길동 IM_SH";
  }

  const fromLabs: ProductMaster[] = [];
  if (portfolio) {
    for (const f of portfolio.funds) {
      if (!f.siteAddress && !f.name) continue;
      if (isLabDeleted(f.name) || isDeletedLabName(f.name)) continue;
      if (isDeletedAddressHint(f.siteAddress) || isDeletedAddressHint(f.businessDesc)) continue;
      const exists = fromSites.some(
        (p) =>
          (f.siteAddress && p.siteAddress.includes(f.siteAddress.slice(0, 8))) ||
          (f.name && p.labName === f.name)
      );
      if (exists) continue;
      const id = `prod-lab-${f.id}`;
      if (isProductDeleted(id)) continue;
      fromLabs.push({
        id,
        labName: f.name,
        fundName: f.fundName,
        siteAddress: f.siteAddress ?? "",
        siteName: f.businessDesc ?? f.name,
        aliases: [f.name, f.fundName, f.siteAddress, f.productCode].filter(Boolean) as string[],
        siteId: null,
        contractAmount: f.setupAmount,
        notes: null,
        createdAt: portfolio.uploadedAt,
        updatedAt: portfolio.uploadedAt,
      });
    }
  }

  return [...fromSites, ...fromLabs];
}

export function invalidateProductCache() {
  products = null;
}

async function ensure(): Promise<ProductMaster[]> {
  if (!products) {
    if (isProductMasterDbConfigured()) {
      try {
        const dbProducts = await sbListProductMaster();
        if (dbProducts.length > 0) {
          products = dbProducts;
          return products;
        }
        const portfolio = await getLabPortfolio();
        products = seedProducts(portfolio);
        await sbBulkUpsertProductMaster(products);
        return products;
      } catch (err) {
        console.warn("[product-registry] supabase load failed, seed fallback:", err);
      }
    }
    const portfolio = await getLabPortfolio();
    products = seedProducts(portfolio);
  }
  return products;
}

function resolveHasProposal(p: ProductMaster): boolean {
  if (p.hasProposal) return true;
  const docs = getDocuments().filter((d) => d.type === "proposal");
  return docs.some((d) => {
    if (p.siteId && d.siteId === p.siteId) return true;
    const hay = `${d.siteName ?? ""} ${d.fileName}`.toLowerCase();
    return [p.siteName, p.siteAddress, ...p.aliases]
      .filter(Boolean)
      .some((key) => {
        const k = String(key).toLowerCase();
        return k.length >= 2 && hay.includes(k);
      });
  });
}

export async function listProducts(): Promise<ProductMaster[]> {
  return [...(await ensure())]
    .map((p) => ({ ...p, hasProposal: resolveHasProposal(p) }))
    .sort((a, b) => {
      const aMissing = !a.labName?.trim() || !a.fundName?.trim() ? 0 : 1;
      const bMissing = !b.labName?.trim() || !b.fundName?.trim() ? 0 : 1;
      if (aMissing !== bMissing) return aMissing - bMissing;

      const aLab = (a.labName || "").trim();
      const bLab = (b.labName || "").trim();
      if (!aLab && bLab) return 1;
      if (aLab && !bLab) return -1;
      return bLab.localeCompare(aLab, "ko", { numeric: true });
    });
}

export async function getProduct(id: string): Promise<ProductMaster | null> {
  return (await ensure()).find((p) => p.id === id) ?? null;
}

export async function upsertProduct(
  input: Omit<ProductMaster, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<ProductMaster> {
  const list = await ensure();
  const now = new Date().toISOString();
  if (input.id) {
    const idx = list.findIndex((p) => p.id === input.id);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        ...input,
        id: input.id,
        updatedAt: now,
      };
      if (isProductMasterDbConfigured()) {
        try {
          await sbUpsertProductMaster(list[idx]);
        } catch (err) {
          console.warn("[product-registry] supabase upsert failed:", err);
        }
      }
      return list[idx];
    }
  }
  const created: ProductMaster = {
    id: input.id ?? `prod-${crypto.randomUUID()}`,
    labName: input.labName,
    fundName: input.fundName,
    siteAddress: input.siteAddress,
    siteName: input.siteName,
    aliases: input.aliases ?? [],
    siteId: input.siteId,
    contractAmount: input.contractAmount,
    notes: input.notes,
    hasProposal: input.hasProposal,
    createdAt: now,
    updatedAt: now,
  };
  list.push(created);
  if (isProductMasterDbConfigured()) {
    try {
      await sbUpsertProductMaster(created);
    } catch (err) {
      console.warn("[product-registry] supabase upsert failed:", err);
    }
  }
  return created;
}

export async function deleteProduct(id: string): Promise<ProductMaster | null> {
  const list = await ensure();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const [removed] = list.splice(idx, 1);
  if (isProductMasterDbConfigured()) {
    try {
      await sbDeleteProductMaster(removed.id);
    } catch (err) {
      console.warn("[product-registry] supabase delete failed:", err);
    }
  }
  rememberDeletedMaster({
    productId: removed.id,
    siteId: removed.siteId,
    labName: removed.labName,
    siteAddress: removed.siteAddress,
    siteName: removed.siteName,
  });
  return removed;
}

/** Match by address / aliases / site name / lab / fund keywords */
export async function matchProduct(query: {
  siteName?: string | null;
  fundName?: string | null;
  location?: string | null;
  fileName?: string | null;
  labName?: string | null;
}): Promise<ProductMaster | null> {
  // 랩 번호는 labName/파일명만 사용 (펀드명·aliases의 제N호는 제외)
  const list = await ensure();
  const labNum = extractLabNumber(query.labName, query.fileName, query.siteName);
  if (labNum) {
    const byLab = list.find(
      (p) => extractLabNumber(p.labName, p.siteName) === labNum
    );
    if (byLab) return byLab;
  }

  const hay = [
    query.siteName,
    query.fundName,
    query.location,
    query.fileName,
    query.labName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!hay.trim()) return null;

  let best: { product: ProductMaster; score: number } | null = null;
  for (const p of list) {
    let score = 0;
    const keys = [
      p.labName,
      p.fundName,
      p.siteAddress,
      p.siteName,
      ...p.aliases,
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());

    for (const key of keys) {
      if (!key || key.length < 2) continue;
      if (hay.includes(key) || key.includes(hay.slice(0, Math.min(hay.length, 12)))) {
        score += key.length;
      }
    }

    if (p.siteAddress) {
      const addrBits = p.siteAddress.replace(/\s+/g, "").toLowerCase();
      const loc = (query.location ?? "").replace(/\s+/g, "").toLowerCase();
      if (loc && (addrBits.includes(loc.slice(0, 6)) || loc.includes(addrBits.slice(0, 6)))) {
        score += 20;
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { product: p, score };
    }
  }

  return best?.product ?? null;
}

function addrLooseMatch(a: string, b: string): boolean {
  const x = a.replace(/\s+/g, "").toLowerCase();
  const y = b.replace(/\s+/g, "").toLowerCase();
  if (!x || !y || x.length < 4 || y.length < 4) return false;
  return x.includes(y.slice(0, 8)) || y.includes(x.slice(0, 8));
}

export function productNeedsRegistration(
  product: ProductMaster | null,
  parsed: { labName?: string | null; fundName?: string | null; location?: string | null }
): boolean {
  if (!product) return true;

  const a = extractLabNumber(product.labName, product.siteName);
  const b = extractLabNumber(parsed.labName);
  // 랩 번호가 같으면 바로 갱신 / 다르면 펀드·주소가 같아도 다른 사업장
  if (a && b) return a !== b ? true : false;

  const fund = parsed.fundName?.trim();
  const addr = parsed.location?.trim();
  const lab = parsed.labName?.trim();

  if (lab && product.labName) {
    const x = lab.replace(/\s+/g, "").toLowerCase();
    const y = product.labName.replace(/\s+/g, "").toLowerCase();
    if (x === y || x.includes(y) || y.includes(x)) return false;
  }
  if (fund && product.fundName) {
    const x = fund.replace(/\s+/g, "").toLowerCase();
    const y = product.fundName.replace(/\s+/g, "").toLowerCase();
    if (x.includes(y) || y.includes(x)) return false;
  }
  if (addr && product.siteAddress && addrLooseMatch(addr, product.siteAddress)) {
    return false;
  }

  return true;
}
