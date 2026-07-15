import { sites } from "@/lib/data/seed";
import { LEGACY_TO_CODE, CODE_TO_LEGACY, CODE_TO_UUID, UUID_TO_CODE } from "@/lib/supabase/site-map";
import type { ProductMaster, Site } from "@/lib/types";

/** Create in-memory CM site + register identity maps for a new product */
export function ensureSiteForProduct(product: ProductMaster): string {
  if (product.siteId && sites.some((s) => s.id === product.siteId)) {
    return product.siteId;
  }

  const slug =
    product.labName
      .replace(/[^\w가-힣]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) ||
    product.siteAddress.slice(0, 12).replace(/\s+/g, "") ||
    "new";

  let siteId = `site-${slug.toLowerCase()}`;
  let n = 1;
  while (sites.some((s) => s.id === siteId)) {
    siteId = `site-${slug.toLowerCase()}-${n++}`;
  }

  const code = `X${String(sites.length + 1).padStart(3, "0")}`;
  const uuid = crypto.randomUUID();

  const site: Site = {
    id: siteId,
    name: product.siteName || product.labName || product.siteAddress || "신규 사업장",
    code,
    address: product.siteAddress || "",
    status: "planned",
    startDate: null,
    endDate: null,
    contractAmount: product.contractAmount,
    contractor: null,
    cmCompany: "코스트CM",
    latestProgressPct: null,
    plannedProgressPct: null,
    latestFundPct: null,
    latestReportMonth: null,
  };

  sites.push(site);

  LEGACY_TO_CODE[siteId] = code;
  CODE_TO_LEGACY[code] = siteId;
  CODE_TO_UUID[code] = uuid;
  UUID_TO_CODE[uuid] = code;

  return siteId;
}
