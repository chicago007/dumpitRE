import { NextRequest, NextResponse } from "next/server";
import {
  deleteProduct,
  getProduct,
  listProducts,
  upsertProduct,
} from "@/lib/data/product-registry";
import { ensureSiteForProduct } from "@/lib/data/create-site";
import { applyProposalMasterData } from "@/lib/data/apply-proposal-master";
import { peekLatestPendingProposal, takePendingProposal } from "@/lib/data/pending-proposals";
import {
  getLabPortfolio,
  removeLabFundsMatching,
  upsertLabFundFromProposal,
} from "@/lib/data/lab-portfolio";
import { persistProposal } from "@/lib/data/repository";
import { resolveReviewByDocumentId } from "@/lib/data/review-queue";
import {
  lockLabNameFromFileName,
  compactSiteAddress,
  type ParsedProposal,
} from "@/lib/analyzers/proposal";
import { stripTemplatePollution, masterAddressIsTrustworthy } from "@/lib/analyzers/proposal-sanitize";

export async function GET() {
  return NextResponse.json(await listProducts());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const documentId = body.documentId ? String(body.documentId) : null;
  const isNewSite = body.isNewSite !== false;
  const labFundId = body.labFundId ? String(body.labFundId) : null;

  let labName = String(body.labName ?? "").trim();
  let fundName = body.fundName ? String(body.fundName).trim() : null;
  let siteAddress = String(body.siteAddress ?? "").trim();
  let siteName = body.siteName ? String(body.siteName).trim() : null;

  // 기존 부동산랩 선택 시 목록 기준으로 식별
  if (!isNewSite && labFundId) {
    const fund = (await getLabPortfolio())?.funds.find((f) => f.id === labFundId);
    if (!fund) {
      return NextResponse.json(
        { error: "선택한 부동산랩을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    labName = fund.name;
    fundName = fund.fundName;
    siteAddress = fund.siteAddress?.trim() || siteAddress;
    siteName = fund.businessDesc?.trim() || fund.name;
  }

  const masterAddress = siteAddress;
  const fillAddressFromProposal = (
    proposalLocation: string | null | undefined
  ) => {
    if (masterAddressIsTrustworthy(masterAddress)) return masterAddress;
    return compactSiteAddress(proposalLocation) || masterAddress || "";
  };

  if (!labName && !siteAddress) {
    return NextResponse.json(
      { error: isNewSite ? "신규 랩명을 입력해 주세요." : "부동산랩을 선택해 주세요." },
      { status: 400 }
    );
  }

  const pending = documentId
    ? takePendingProposal(documentId)
    : peekLatestPendingProposal();
  if (!documentId && pending) {
    takePendingProposal(pending.documentId);
  }
  let parsed: ParsedProposal | null = pending?.parsed
    ? {
        ...pending.parsed,
        labName: labName || pending.parsed.labName,
        fundName: isNewSite
          ? fundName ?? pending.parsed.fundName
          : fundName ?? pending.parsed.fundName,
        location: isNewSite
          ? siteAddress || pending.parsed.location
          : fillAddressFromProposal(pending.parsed.location),
        siteName: siteName || pending.parsed.siteName,
      }
    : null;

  if (parsed && pending?.pdfText) {
    try {
      const { enrichProposalWithLlm } = await import("@/lib/analyzers/proposal-llm");
      const { parsed: enriched } = await enrichProposalWithLlm(
        parsed,
        pending.pdfText,
        pending.fileName
      );
      parsed = lockLabNameFromFileName(
        stripTemplatePollution(
          {
            ...enriched,
            labName: labName || enriched.labName,
            fundName: isNewSite ? enriched.fundName : fundName,
            location: isNewSite
              ? enriched.location
              : fillAddressFromProposal(enriched.location),
            siteName: isNewSite ? enriched.siteName : siteName,
          },
          labName
        ),
        pending.fileName
      );
    } catch {
      parsed = stripTemplatePollution(parsed, labName);
    }
  } else if (parsed) {
    parsed = stripTemplatePollution(parsed, labName);
  }

  if (parsed) {
    const products = await listProducts();
    const existing =
      (body.id ? await getProduct(String(body.id)) : null) ??
      products.find(
        (p) =>
          p.labName &&
          labName &&
          p.labName.replace(/\s+/g, "") === labName.replace(/\s+/g, "")
      ) ??
      null;
    const master = await applyProposalMasterData(
      {
        ...parsed,
        location: isNewSite
          ? parsed.location
          : fillAddressFromProposal(parsed.location) || existing?.siteAddress || null,
        fundName: isNewSite ? parsed.fundName : fundName,
        labName,
      },
      existing,
      pending?.fileName ?? "proposal.pdf",
      { preserveIdentity: !isNewSite }
    );
    const applyResult = await persistProposal(master.siteId, {
      ...parsed,
      labName: master.product.labName,
      fundName: master.product.fundName,
      location: master.product.siteAddress,
      siteName: master.product.siteName,
    });
    if (documentId) await resolveReviewByDocumentId(documentId);
    return NextResponse.json({
      product: master.product,
      applied: [...master.applied, ...(applyResult.applied ?? [])],
      warnings: applyResult.warnings ?? [],
      message: "제안서 조건이 상품·전체현황에 반영되었습니다. 전체현황을 새로고침해 주세요.",
    });
  }

  // 수기 등록만 한 경우에도 전체현황(랩 목록)에 반드시 반영
  let product = await upsertProduct({
    id: body.id,
    labName,
    fundName,
    siteAddress,
    siteName: siteName || labName,
    aliases: [labName, fundName, siteAddress, siteName].filter(Boolean) as string[],
    siteId: body.siteId ?? null,
    contractAmount: body.contractAmount ?? null,
    notes: body.notes ?? null,
    hasProposal: true,
  });

  if (isNewSite || !product.siteId) {
    const siteId = ensureSiteForProduct(product);
    product = await upsertProduct({ ...product, siteId, hasProposal: true });
  }

  const fund = await upsertLabFundFromProposal({
    labName: product.labName || product.siteName || "신규랩",
    fundName: product.fundName,
    siteAddress: product.siteAddress,
    businessDesc: product.siteName,
    setupAmount: product.contractAmount,
    notes: product.notes,
  });

  return NextResponse.json({
    product,
    applied: [`전체현황 반영: ${fund.name}`, "제안서 여부: 있음"],
    warnings: [],
    message: "상품이 등록되었고 전체현황에도 반영되었습니다. 전체현황을 새로고침해 주세요.",
  });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const labName = req.nextUrl.searchParams.get("labName");
  const siteName = req.nextUrl.searchParams.get("siteName");
  const siteAddress = req.nextUrl.searchParams.get("siteAddress");

  if (id) {
    const removed = await deleteProduct(id);
    if (!removed) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

    const labRemoval = await removeLabFundsMatching({
      labName: removed.labName,
      fundName: removed.fundName,
      siteAddress: removed.siteAddress,
      siteName: removed.siteName,
    });

    return NextResponse.json({
      ok: true,
      removedProduct: removed,
      labPortfolio: labRemoval,
      message:
        labRemoval.removed > 0
          ? `상품 삭제 + 전체현황에서 ${labRemoval.names.join(", ")} 제거됨`
          : "상품 삭제됨 (전체현황 매칭 항목 없음)",
    });
  }

  if (labName || siteName || siteAddress) {
    const labRemoval = await removeLabFundsMatching({ labName, siteName, siteAddress });
    return NextResponse.json({
      ok: true,
      labPortfolio: labRemoval,
      message:
        labRemoval.removed > 0
          ? `전체현황에서 ${labRemoval.names.join(", ")} 제거됨`
          : "매칭된 전체현황 항목 없음",
    });
  }

  return NextResponse.json({ error: "id 또는 labName/siteName 필요" }, { status: 400 });
}
