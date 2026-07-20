/**
 * 주소 기반 포트폴리오 매칭
 *
 * 동일 사업장·다른 사업자(예: 47호/48호 상계동)는 자동 매칭하지 않고
 * 후보만 돌려 수동 확인하게 한다.
 */

import type { GisungExtracted, PortfolioMatchCandidate } from "./types";

export interface PortfolioFundRow {
  name: string;
  fund_name: string | null;
  fund_code: string | null;
  site_address: string | null;
  status: string;
  planned_progress_pct: number | null;
  actual_progress_pct: number | null;
  developer?: string | null;
  contractor?: string | null;
  trust_company?: string | null;
  business_desc?: string | null;
}

/** "경기도 수원시 팔달구 인계동 1123-19" → 행정구역 + 번지 */
export function addressTokens(addr: string): {
  sido: string | null;
  sigungu: string | null;
  dong: string | null;
  bunjis: string[];
  compact: string;
} {
  const raw = addr.normalize("NFC").replace(/\s+/g, " ").trim();
  const compact = raw.replace(/\s+/g, "").toLowerCase();

  const sido =
    raw.match(
      /(서울특별시|서울시|경기도|인천광역시|인천시|부산광역시|대구광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|세종시|강원특별자치도|강원도|충청북도|충북|충청남도|충남|전북특별자치도|전라북도|전북|전라남도|전남|경상북도|경북|경상남도|경남|제주특별자치도|제주도|제주)/
    )?.[1]
      ?.replace(/특별시|광역시|특별자치시|특별자치도|도$/g, "")
      .replace(/^서울시$/, "서울")
      .replace(/^인천시$/, "인천")
      .replace(/^세종시$/, "세종")
      .replace(/^제주도$/, "제주")
      .replace(/^충북$/, "충청북")
      .replace(/^충남$/, "충청남")
      .replace(/^전북$/, "전라북")
      .replace(/^전남$/, "전라남")
      .replace(/^경북$/, "경상북")
      .replace(/^경남$/, "경상남") ?? null;

  // 시·군·구 (수원시 / 서귀포시 / 은평구 / 팔달구 …)
  const sigunguMatches = [
    ...raw.matchAll(/([가-힣]{1,10}(?:시|군|구))/g),
  ].map((m) => m[1]);
  // "수원시 팔달구" → 구 우선, 없으면 시/군
  const sigungu =
    [...sigunguMatches].reverse().find((s) => /구$/.test(s)) ??
    sigunguMatches.find((s) => /(?:시|군)$/.test(s) && !/특별시|광역시/.test(s)) ??
    null;

  // 읍·면·동 (시군구 뒤)
  const afterAdmin = compact
    .replace(/서울특별시|서울시|경기도|인천광역시|제주특별자치도|제주도/g, "")
    .split(/[시군구]/)
    .pop() ?? compact;
  const dong =
    afterAdmin.match(/^([가-힣]{1,6}(?:동|읍|면|리))/)?.[1] ??
    compact.match(/([가-힣]{2,3}(?:동|읍|면))(?=\d|,|-|번|일|외|$)/)?.[1] ??
    null;

  const bunjis = [...compact.matchAll(/-?(\d{1,5})(?:-(\d{1,5}))?/g)]
    .map((m) => (m[2] ? `${m[1]}-${m[2]}` : m[1]))
    .filter((b) => b.length >= 1);

  return { sido, sigungu, dong, bunjis, compact };
}

function normAdmin(s: string | null): string | null {
  if (!s) return null;
  return s.replace(/\s+/g, "").toLowerCase();
}

/** 시도/구군/읍면동이 서로 모순되면 true (한쪽만 있으면 비교 생략) */
export function adminDivisionsConflict(
  a: ReturnType<typeof addressTokens>,
  b: ReturnType<typeof addressTokens>
): boolean {
  const as = normAdmin(a.sido);
  const bs = normAdmin(b.sido);
  if (as && bs && as !== bs) return true;

  const ag = normAdmin(a.sigungu);
  const bg = normAdmin(b.sigungu);
  if (ag && bg && ag !== bg) return true;

  const ad = normAdmin(a.dong);
  const bd = normAdmin(b.dong);
  if (ad && bd && ad !== bd) return true;

  return false;
}

/** 동일 사업장 판별용 키 (행정구역 + 본번) */
export function addressSiteKey(addr: string): string {
  const t = addressTokens(addr);
  const mains = [
    ...new Set(
      t.bunjis
        .map((b) => b.replace(/^-/, "").split("-")[0])
        .filter((n) => n.length >= 2)
    ),
  ].sort();
  const admin = [t.sido, t.sigungu, t.dong].filter(Boolean).join("/");
  if (!admin && mains.length === 0) return t.compact.slice(0, 40);
  return `${admin}|${mains.join(",")}`;
}

/** 두 주소가 같은 사업장(동일·거의 동일 필지)인지 */
export function addressesShareSite(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const ta = addressTokens(a);
  const tb = addressTokens(b);
  if (adminDivisionsConflict(ta, tb)) return false;
  // 동이 같아야 함
  if (!ta.dong || !tb.dong || ta.dong !== tb.dong) return false;

  const mains = (t: ReturnType<typeof addressTokens>) =>
    new Set(
      t.bunjis
        .map((x) => x.replace(/^-/, "").split("-")[0])
        .filter((n) => n.length >= 2)
    );
  const ma = mains(ta);
  const mb = mains(tb);
  // 같은 동 + 본번 겹침 → 동일 사업장
  if ([...ma].some((x) => mb.has(x))) return true;

  const ka = addressSiteKey(a);
  const kb = addressSiteKey(b);
  if (ka && kb && ka === kb && !ka.endsWith("|")) return true;
  return scoreAddressMatch(a, b) >= 55;
}

/**
 * 주소 유사도.
 * 1) 시도·구군·읍면동이 다르면 0
 * 2) 행정구역이 맞을 때만 번지 비교
 */
export function scoreAddressMatch(extracted: string, stored: string): number {
  const a = addressTokens(extracted);
  const b = addressTokens(stored);

  if (adminDivisionsConflict(a, b)) return 0;

  // 동이 양쪽 다 있는데 다름 → 이미 conflict에서 걸림.
  // 한쪽만 동이 없으면 번지만으로 맞추지 않음 (86 ⊂ 1186 사고 방지)
  if ((a.dong && !b.dong) || (!a.dong && b.dong)) {
    // 구까지는 같고 동 정보가 한쪽만 있으면 약한 점수만
    if (
      a.sigungu &&
      b.sigungu &&
      normAdmin(a.sigungu) === normAdmin(b.sigungu)
    ) {
      return 20;
    }
    if (a.sido && b.sido && normAdmin(a.sido) === normAdmin(b.sido)) {
      return 10;
    }
    return 0;
  }

  if (!a.dong || !b.dong || a.dong !== b.dong) {
    // 동 정보가 아예 없으면 주소 매칭으로 쓰지 않음
    return 0;
  }

  let score = 40; // 동 일치

  if (
    a.sigungu &&
    b.sigungu &&
    normAdmin(a.sigungu) === normAdmin(b.sigungu)
  ) {
    score += 15;
  }
  if (a.sido && b.sido && normAdmin(a.sido) === normAdmin(b.sido)) {
    score += 10;
  }

  // 번지는 행정구역이 맞은 뒤에만
  const bNorm = b.bunjis.map((x) => x.replace(/^-/, ""));
  const aNorm = [...new Set(a.bunjis)].map((x) => x.replace(/^-/, ""));

  const bunjiHit = (x: string, y: string): boolean => {
    if (x === y) return true;
    if (x.includes("-") || y.includes("-")) {
      return x.startsWith(y + "-") || y.startsWith(x + "-");
    }
    return false;
  };

  const overlap = bNorm.filter((x) => aNorm.some((y) => bunjiHit(x, y)));
  const uniq = [...new Set(overlap)];
  score += Math.min(35, uniq.length * 18);

  return Math.min(100, score);
}

/** 포트폴리오에서 해당 주소와 동일 사업장인 랩 목록 */
export function findFundsSharingAddress(
  funds: PortfolioFundRow[],
  address: string | null | undefined
): PortfolioFundRow[] {
  if (!address?.trim()) return [];
  return funds.filter(
    (f) => f.site_address && addressesShareSite(address, f.site_address)
  );
}

/**
 * 후보·전체 포트폴리오 기준으로 동일주소 그룹이 있는지.
 * 47·48호처럼 주소가 같으면 자동매칭 금지.
 */
export function findSharedSiteGroup(
  candidates: PortfolioMatchCandidate[],
  allFunds: PortfolioFundRow[],
  preferredAddress?: string | null
): PortfolioMatchCandidate[] {
  const addr =
    preferredAddress?.trim() ||
    candidates.find((c) => c.siteAddress)?.siteAddress ||
    null;
  if (!addr) return [];

  const fromPortfolio = findFundsSharingAddress(allFunds, addr);
  if (fromPortfolio.length >= 2) {
    const byName = new Map(candidates.map((c) => [c.labName, c]));
    return fromPortfolio
      .map((f) => {
        const existing = byName.get(f.name);
        if (existing) return existing;
        return {
          labName: f.name,
          fundName: f.fund_name,
          fundCode: f.fund_code,
          siteAddress: f.site_address,
          status: f.status,
          plannedProgressPct:
            f.planned_progress_pct != null
              ? Number(f.planned_progress_pct)
              : null,
          actualProgressPct:
            f.actual_progress_pct != null
              ? Number(f.actual_progress_pct)
              : null,
          score: scoreAddressMatch(addr, f.site_address!),
        } satisfies PortfolioMatchCandidate;
      })
      .sort((a, b) => b.score - a.score || a.labName.localeCompare(b.labName, "ko"));
  }

  // 후보끼리만 동일 주소
  const top = candidates[0];
  if (!top?.siteAddress) return [];
  const shared = candidates.filter(
    (c) =>
      c.score >= 25 &&
      c.siteAddress &&
      addressesShareSite(top.siteAddress, c.siteAddress)
  );
  return shared.length >= 2 ? shared : [];
}

export function matchPortfolio(
  extracted: GisungExtracted,
  funds: PortfolioFundRow[]
): PortfolioMatchCandidate[] {
  const addrParts = [
    extracted.siteAddress,
    extracted.projectName,
    extracted.fileName,
  ]
    .filter(Boolean)
    .join(" ");
  if (!addrParts.trim()) return [];

  const scored: PortfolioMatchCandidate[] = funds.map((f) => {
    let score = 0;
    if (f.site_address) {
      score = Math.max(score, scoreAddressMatch(addrParts, f.site_address));
      if (extracted.siteAddress) {
        score = Math.max(
          score,
          scoreAddressMatch(extracted.siteAddress, f.site_address)
        );
      }
      if (extracted.projectName) {
        score = Math.max(
          score,
          scoreAddressMatch(extracted.projectName, f.site_address)
        );
      }
      if (extracted.fileName) {
        score = Math.max(
          score,
          scoreAddressMatch(extracted.fileName, f.site_address)
        );
      }
    }

    // 제목 펀드 호수 힌트 — 필증·파일명 기준 매칭 강화
    if (extracted.fundRoundHint != null && f.fund_name) {
      const m = f.fund_name.match(/(\d+)/);
      if (m && Number(m[1]) === extracted.fundRoundHint) score += 45;
    }
    if (extracted.fundRoundHint != null && f.name) {
      const m = f.name.match(/(\d+)/);
      if (m && Number(m[1]) === extracted.fundRoundHint && !f.fund_name)
        score += 20;
    }

    return {
      labName: f.name,
      fundName: f.fund_name,
      fundCode: f.fund_code,
      siteAddress: f.site_address,
      status: f.status,
      plannedProgressPct:
        f.planned_progress_pct != null ? Number(f.planned_progress_pct) : null,
      actualProgressPct:
        f.actual_progress_pct != null ? Number(f.actual_progress_pct) : null,
      score,
    };
  });

  return scored.filter((c) => c.score >= 25).sort((a, b) => b.score - a.score);
}

export interface AutoMatchDecision {
  /** 자동 저장할 후보 — 확인이 필요하면 항상 null */
  match: PortfolioMatchCandidate | null;
  /** 동일 주소·다른 사업자 등으로 확인 필요 */
  needsConfirmation: boolean;
  sharedSiteGroup: PortfolioMatchCandidate[];
  /** UI 추천(프리셀렉트) — 확인은 하되 펀드명·사업자로 추정한 값 */
  suggested: PortfolioMatchCandidate | null;
  reason: string | null;
  /** 펀드명·사업자로 좁힌 경우 */
  resolvedBy?: "fund" | "operator" | "address" | null;
}

function fundRoundFromName(fundName: string | null | undefined): number | null {
  if (!fundName) return null;
  const m =
    fundName.match(/펀드\s*(\d+)\s*호/) ??
    fundName.match(/제\s*(\d+)\s*호/) ??
    fundName.match(/(\d+)\s*호/);
  return m ? Number(m[1]) : null;
}

function normParty(s: string): string {
  return s
    .normalize("NFC")
    .replace(/\s+/g, "")
    .replace(/\(주\)|주식회사|㈜/g, "")
    .toLowerCase();
}

function partyOverlap(hint: string, stored: string | null | undefined): boolean {
  if (!stored?.trim()) return false;
  const a = normParty(hint);
  const b = normParty(stored);
  if (a.length < 2 || b.length < 2) return false;
  return a.includes(b) || b.includes(a) || (a.length >= 4 && b.includes(a.slice(0, 4)));
}

/**
 * 동일 사업장 그룹 안에서 펀드명·사업자로 유일한 후보를 고름.
 * 유일하면 그 후보, 아니면 null (확인 필요).
 */
export function resolveSharedSiteByStructure(
  group: PortfolioMatchCandidate[],
  allFunds: PortfolioFundRow[],
  opts: {
    fundRoundHints?: number[];
    fundNameHint?: string | null;
    operatorHints?: string[];
  }
): { match: PortfolioMatchCandidate; by: "fund" | "operator" } | null {
  if (group.length < 2) return null;

  const fundByName = new Map(allFunds.map((f) => [f.name, f]));
  const hints = opts.fundRoundHints?.filter((n) => Number.isFinite(n)) ?? [];

  // 1) 단일 펀드 호수 → 펀드명이 정확히 일치하는 후보만
  if (hints.length === 1) {
    const n = hints[0];
    const byFund = group.filter((c) => {
      const round = fundRoundFromName(c.fundName);
      if (round === n) return true;
      const lab = c.labName.match(/(\d+)\s*호/);
      // 랩 번호와 펀드 번호가 같은 경우만 보조 (드묾)
      return lab != null && Number(lab[1]) === n && !c.fundName;
    });
    if (byFund.length === 1) return { match: byFund[0], by: "fund" };
  }

  // 2) 펀드명 문자열 힌트
  const nameHint = opts.fundNameHint?.trim();
  if (nameHint && nameHint.length >= 4) {
    const hintNorm = normParty(nameHint);
    const byName = group.filter((c) => {
      if (!c.fundName) return false;
      const fn = normParty(c.fundName);
      return fn.includes(hintNorm) || hintNorm.includes(fn) || fundRoundFromName(c.fundName) === fundRoundFromName(nameHint);
    });
    if (byName.length === 1) return { match: byName[0], by: "fund" };
  }

  // 3) 시행·시공·신탁 등 사업자
  const operators = (opts.operatorHints ?? []).filter((h) => h.trim().length >= 2);
  if (operators.length > 0) {
    const scored = group.map((c) => {
      const row = fundByName.get(c.labName);
      let hits = 0;
      for (const h of operators) {
        if (
          partyOverlap(h, row?.developer) ||
          partyOverlap(h, row?.contractor) ||
          partyOverlap(h, row?.trust_company) ||
          partyOverlap(h, row?.business_desc) ||
          partyOverlap(h, c.fundName)
        ) {
          hits += 1;
        }
      }
      return { c, hits };
    });
    const positive = scored.filter((s) => s.hits > 0).sort((a, b) => b.hits - a.hits);
    if (positive.length === 1) return { match: positive[0].c, by: "operator" };
    if (
      positive.length >= 2 &&
      positive[0].hits > positive[1].hits
    ) {
      return { match: positive[0].c, by: "operator" };
    }
  }

  return null;
}

/**
 * 자동 저장 여부 결정.
 * - 동일 주소(사업구조만 다른 경우): 펀드명·사업자로 추천만 하고 **반드시 확인**
 * - 파일명 복수 호수 / 같은 동 / 유사 점수 / 저신뢰: 확인 (버리지 않음)
 * - 유일·고신뢰 주소 매칭만 자동 저장
 */
export function decideAutoMatch(
  candidates: PortfolioMatchCandidate[],
  allFunds: PortfolioFundRow[],
  opts?: {
    extractedAddress?: string | null;
    multiFundHints?: number[];
    fundNameHint?: string | null;
    operatorHints?: string[];
  }
): AutoMatchDecision {
  const sharedSiteGroup = findSharedSiteGroup(
    candidates,
    allFunds,
    opts?.extractedAddress
  );

  const structureOpts = {
    fundRoundHints: opts?.multiFundHints,
    fundNameHint: opts?.fundNameHint,
    operatorHints: opts?.operatorHints,
  };

  if (sharedSiteGroup.length >= 2) {
    const hints = opts?.multiFundHints ?? [];
    const resolved = resolveSharedSiteByStructure(
      sharedSiteGroup,
      allFunds,
      structureOpts
    );
    const suggested = resolved?.match ?? null;
    const byHint =
      hints.length >= 2
        ? `동일 사업장에 호수 ${hints.join("·")}가 함께 있습니다.`
        : `동일 사업장 주소에 부동산랩 ${sharedSiteGroup.length}건이 있습니다.`;
    const tip = suggested
      ? ` 펀드명·사업자 기준으로 「${suggested.labName}」이(가) 유력합니다. 맞는지 확인해 주세요.`
      : ` 펀드명·사업자로 특정되지 않았습니다. 해당 랩을 선택해 주세요.`;

    return {
      match: null,
      needsConfirmation: true,
      sharedSiteGroup,
      suggested,
      reason: byHint + tip,
      resolvedBy: resolved?.by ?? null,
    };
  }

  // 파일명 단일 호수 → 펀드N호가 유일하면 그 랩 우선 (86호 착공접수증 → 펀드86/61호)
  const hints = opts?.multiFundHints ?? [];
  if (hints.length === 1) {
    const n = hints[0];
    const fundHits = allFunds.filter((f) => fundRoundFromName(f.fund_name) === n);
    if (fundHits.length === 1) {
      const fund = fundHits[0];
      const cand =
        candidates.find((c) => c.labName === fund.name) ??
        ({
          labName: fund.name,
          fundName: fund.fund_name,
          fundCode: fund.fund_code,
          siteAddress: fund.site_address,
          status: fund.status,
          plannedProgressPct:
            fund.planned_progress_pct != null
              ? Number(fund.planned_progress_pct)
              : null,
          actualProgressPct:
            fund.actual_progress_pct != null
              ? Number(fund.actual_progress_pct)
              : null,
          score: 90,
        } satisfies PortfolioMatchCandidate);

      const addressTop = candidates[0];
      if (
        addressTop &&
        addressTop.labName !== fund.name &&
        addressTop.score >= 40 &&
        addressTop.score > cand.score
      ) {
        return {
          match: null,
          needsConfirmation: true,
          sharedSiteGroup: [cand, addressTop],
          suggested: cand,
          reason: `파일명 ${n}호는 「${fund.name}」(펀드${n}호)와 맞지만, 주소 후보는 「${addressTop.labName}」입니다. 확인해 주세요.`,
          resolvedBy: "fund",
        };
      }

      return {
        match: cand,
        needsConfirmation: false,
        sharedSiteGroup: [],
        suggested: cand,
        reason: null,
        resolvedBy: "fund",
      };
    }
  }

  if (opts?.multiFundHints && opts.multiFundHints.length >= 2) {
    return {
      match: null,
      needsConfirmation: true,
      sharedSiteGroup: candidates.slice(0, 8),
      suggested: null,
      reason: `파일명에 여러 호수(${opts.multiFundHints.join(", ")}호)가 있어 확인이 필요합니다. 해당 부동산랩을 선택해 주세요.`,
      resolvedBy: null,
    };
  }

  const top = candidates[0];
  if (!top || top.score < 40) {
    return {
      match: null,
      needsConfirmation: true,
      sharedSiteGroup: [],
      suggested: top ?? null,
      reason:
        candidates.length > 0
          ? `자동 매칭 신뢰도가 낮습니다. 후보 ${candidates.length}건 중 부동산랩을 선택해 주세요.`
          : "사업장 주소로 자동 매칭되지 않았습니다. 목록에서 부동산랩을 선택해 주세요. (업로드는 대기열에 유지됩니다)",
      resolvedBy: null,
    };
  }

  const topDong = top.siteAddress
    ? addressTokens(top.siteAddress).dong
    : null;
  if (topDong) {
    const sameDong = candidates.filter((c) => {
      if (!c.siteAddress || c.score < 40) return false;
      return addressTokens(c.siteAddress).dong === topDong;
    });
    if (sameDong.length >= 2) {
      const resolved = resolveSharedSiteByStructure(
        sameDong,
        allFunds,
        structureOpts
      );
      const suggested = resolved?.match ?? top;
      return {
        match: null,
        needsConfirmation: true,
        sharedSiteGroup: sameDong,
        suggested,
        reason: `같은 동(${topDong})에 후보가 ${sameDong.length}건 있습니다.${
          suggested
            ? ` 「${suggested.labName}」이(가) 유력합니다. 확인해 주세요.`
            : " 펀드명·사업자를 확인한 뒤 선택해 주세요."
        }`,
        resolvedBy: resolved?.by ?? null,
      };
    }
  }

  const second = candidates[1];
  if (second && second.score >= 40 && top.score - second.score < 20) {
    return {
      match: null,
      needsConfirmation: true,
      sharedSiteGroup: candidates.slice(0, 5),
      suggested: top,
      reason: `유사 점수 후보가 있어 확인이 필요합니다. 「${top.labName}」이(가) 1순위입니다.`,
      resolvedBy: null,
    };
  }

  return {
    match: top,
    needsConfirmation: false,
    sharedSiteGroup: [],
    suggested: top,
    reason: null,
    resolvedBy: "address",
  };
}

/** @deprecated use decideAutoMatch */
export function pickAutoMatch(
  candidates: PortfolioMatchCandidate[],
  allFunds: PortfolioFundRow[] = []
): PortfolioMatchCandidate | null {
  return decideAutoMatch(candidates, allFunds).match;
}
