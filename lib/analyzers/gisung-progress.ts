/**
 * 기성실사보고서 텍스트 파서
 */
import type { GisungExtracted } from "@/lib/progress/types";

export function normalizeText(raw: string): string {
  return raw
    // PDF 텍스트 레이어의 null 바이트가 번지 숫자를 지우는 경우 있음 → 제거 후 공백 정리
    .replace(/\0+/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function inferDocumentKind(
  fileName: string,
  text: string
): GisungExtracted["documentKind"] {
  const n = `${fileName}\n${text.slice(0, 800)}`.replace(/\s+/g, "").normalize("NFC");
  if (/공정확인/.test(n)) return "process_confirm";
  if (/기성/.test(n)) return "gisung";
  if (/착공\s*필증|착공필증|착공신고|착공허가|착공접수/.test(n) || (/착공/.test(n) && /필증|접수증/.test(n))) {
    return "permit_start";
  }
  if (
    /사업계획\s*필증|사업계획필증|사업계획\s*승인|사업계획승인/.test(n) ||
    (/사업계획/.test(n) && /필증|승인/.test(n))
  ) {
    return "permit_business_plan";
  }
  if (
    /인허가\s*필증|인허가필증|건축허가|개발행위허가/.test(n) ||
    (/인허가/.test(n) && /필증|허가/.test(n))
  ) {
    return "permit_approval";
  }
  if (/필증/.test(n)) {
    if (/착공/.test(n)) return "permit_start";
    if (/사업계획/.test(n)) return "permit_business_plan";
    if (/인허가|허가/.test(n)) return "permit_approval";
  }
  return "unknown";
}

export function permitLabelForKind(
  kind: GisungExtracted["documentKind"]
): string | null {
  switch (kind) {
    case "permit_start":
      return "착공 필증";
    case "permit_business_plan":
      return "사업계획 필증";
    case "permit_approval":
      return "인허가 필증";
    default:
      return null;
  }
}

/** 파일명 _260527 / 2026-05-27 형태 */
export function extractDateFromFileName(fileName: string): string | null {
  const n = fileName.normalize("NFC");
  const iso = n.match(/(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const short = n.match(/(?:^|[_\-\s])(\d{2})(\d{2})(\d{2})(?:[_\-.]|$)/);
  if (short) {
    const yy = Number(short[1]);
    const year = yy >= 70 ? 1900 + yy : 2000 + yy;
    return `${year}-${short[2]}-${short[3]}`;
  }
  return null;
}

export function isPermitDocumentKind(
  kind: GisungExtracted["documentKind"]
): boolean {
  return (
    kind === "permit_start" ||
    kind === "permit_business_plan" ||
    kind === "permit_approval"
  );
}

/** 파일명·제목에서 복수 호수 (예: 67,68호 → [67,68]) */
export function extractFundRoundHints(fileName: string, text: string): number[] {
  const hay = `${fileName}\n${text.slice(0, 1500)}`.normalize("NFC");
  const found = new Set<number>();

  for (const m of hay.matchAll(
    /(\d{1,3})\s*[,·\/]\s*(\d{1,3})(?:\s*[,·\/]\s*(\d{1,3}))?\s*호/g
  )) {
    for (const g of [m[1], m[2], m[3]]) {
      if (!g) continue;
      const n = Number(g);
      if (n >= 1 && n <= 200) found.add(n);
    }
  }

  if (found.size === 0) {
    const patterns = [
      /펀드\s*(\d+)\s*호/g,
      /부동산랩\s*(\d+)\s*호/g,
      /(?:^|[^\d])(\d{1,3})\s*호(?!\s*기성)/g,
    ];
    for (const p of patterns) {
      for (const m of hay.matchAll(p)) {
        const n = Number(m[1]);
        if (n >= 1 && n <= 200) found.add(n);
      }
      if (found.size > 0) break;
    }
  }

  return [...found];
}

/** 제목·파일명에서 펀드 호수 (예: 펀드75호, 75호) — 복수면 첫 값 */
export function extractFundRoundHint(
  fileName: string,
  text: string
): number | null {
  const hints = extractFundRoundHints(fileName, text);
  return hints[0] ?? null;
}

function extractProjectName(text: string): string | null {
  const m =
    text.match(/『([^』]{8,120})』/) ??
    text.match(/용역명\s*[:：]?\s*([^\n]{8,120})/);
  if (!m) return null;
  return m[1].replace(/\s+/g, " ").trim();
}

/** 보고서 제목·본문에서 펀드명 힌트 */
export function extractFundNameHint(
  fileName: string,
  text: string
): string | null {
  const head = `${fileName}\n${text.slice(0, 2500)}`.normalize("NFC");
  const patterns = [
    /((?:엘엔에스|엘앤에스)[^\n]{0,40}제\s*\d+\s*호)/,
    /(일반\s*사모투자신탁[^\n]{0,40}제\s*\d+\s*호)/,
    /(사모투자신탁[^\n]{0,40}제\s*\d+\s*호)/,
    /(펀드\s*\d+\s*호)/,
    /(투자신탁\s*제\s*\d+\s*호)/,
  ];
  for (const p of patterns) {
    const m = head.match(p);
    if (m?.[1]) return m[1].replace(/\s+/g, " ").trim();
  }
  return null;
}

/** 시행사·시공사·사업자·위탁자 등 */
export function extractOperatorHints(text: string): string[] {
  const head = text.slice(0, 4000);
  const hints: string[] = [];
  const patterns = [
    /시행\s*사\s*[:：]?\s*([^\n]{2,40})/,
    /시공\s*사\s*[:：]?\s*([^\n]{2,40})/,
    /사업\s*자\s*[:：]?\s*([^\n]{2,40})/,
    /위탁\s*자\s*[:：]?\s*([^\n]{2,40})/,
    /신탁\s*사\s*[:：]?\s*([^\n]{2,40})/,
    /건설사업관리자?\s*[:：]?\s*([^\n]{2,40})/,
  ];
  for (const p of patterns) {
    const m = head.match(p);
    if (!m?.[1]) continue;
    const v = m[1]
      .replace(/\s+/g, " ")
      .replace(/[|｜].*$/, "")
      .replace(/\d{4}\s*년.*$/, "")
      .trim();
    if (v.length >= 2 && v.length <= 40) hints.push(v);
  }
  return [...new Set(hints)];
}

function extractSiteAddressFromFileName(fileName: string): string | null {
  const n = fileName.normalize("NFC").replace(/\s+/g, " ");
  const full =
    n.match(
      /((?:서울특별시|서울시|경기도)[^,]{5,60}\d{1,5}(?:-\d{1,5})?)/
    ) ??
    n.match(
      /((?:수원시|의정부시|화성시|안양시)?\s*[가-힣]+구?\s*[가-힣]+동\s*\d{1,5}(?:-\d{1,5})?)/
    ) ??
    n.match(/([가-힣]+동\s*\d{1,5}(?:-\d{1,5})?)/);
  if (!full) return null;
  return full[1].replace(/\s+/g, " ").trim();
}

function extractSiteAddress(text: string, fileName?: string): string | null {
  const fromFile = fileName ? extractSiteAddressFromFileName(fileName) : null;
  if (fromFile && /\d/.test(fromFile)) return fromFile;

  const patterns = [
    /대지위치\s*\n?\s*([^\n]{8,80})/,
    /(서울특별시|서울시|경기도|인천|부산|대구|광주|대전|울산|세종|제주)[^\n]{5,60}\d{1,5}(?:-\d{1,5})?/,
    /((?:도봉|노원|강북|성북|광진|의정부|안양|수원|창동|자양|호원|인계|번|등촌|병점|상계|미아동|녹번|불광|동홍)[^\n]{0,40}\d{1,5}(?:-\d{1,5})?(?:,\s*-?\d{1,5})*)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      let addr = (m[1] ?? m[0]).replace(/\s+/g, " ").trim();
      addr = addr.replace(/오피스텔.*$/, "").replace(/신축공사.*$/, "").trim();
      // 관리번호·접수번호 등 오인 제거
      if (/관리번호|접수번호|민원|확인서|^\s*번호/.test(addr)) continue;
      if (!/[가-힣]{2,}(?:시|군|구|동|읍|면|리)/.test(addr) && !/[가-힣]+동/.test(addr)) {
        continue;
      }
      if (addr.length >= 6 && /\d/.test(addr)) return addr;
    }
  }
  if (fromFile) return fromFile;
  return null;
}

/**
 * 공정진행현황 합계 행
 * 예: 합 계 100.00% 1.15% 0.92% 2.37% 1.94% 3.52% 2.86% 81.25%
 * → 보할, 전회계획/실적, 금회계획/실적, 누계계획/실적, 달성률
 */
export function extractCumulativeProgress(text: string): {
  plannedProgressPct: number | null;
  actualProgressPct: number | null;
  achievementPct: number | null;
} {
  const compact = text.replace(/\s+/g, " ");
  const row =
    compact.match(
      /합\s*계\s+100(?:\.00)?%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+|#DIV\/0!)(?:%)?/
    ) ??
    compact.match(
      /합\s*계\s+100(?:\.00)?%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%\s+([\d.]+)%/
    );

  if (row) {
    // 8값: … 누계계획[5] 누계실적[6] 달성률[7]
    if (row.length >= 8) {
      const planned = Number(row[5]);
      const actual = Number(row[6]);
      const achRaw = row[7];
      const achievement =
        achRaw === "#DIV/0!" || achRaw == null ? null : Number(achRaw);
      return {
        plannedProgressPct: Number.isFinite(planned) ? planned : null,
        actualProgressPct: Number.isFinite(actual) ? actual : null,
        achievementPct:
          achievement != null && Number.isFinite(achievement) ? achievement : null,
      };
    }
    // 6값: … 누계계획[5] 누계실적[6]
    if (row.length >= 7) {
      const planned = Number(row[5]);
      const actual = Number(row[6]);
      return {
        plannedProgressPct: Number.isFinite(planned) ? planned : null,
        actualProgressPct: Number.isFinite(actual) ? actual : null,
        achievementPct: null,
      };
    }
  }

  // 공정확인서 간단 표: 계획(%) 실적(%) … / 대비·달성률
  const confirmRow =
    compact.match(
      /공정\s*현황\s*계획\s*\(%\)\s*실적\s*\(%\)(?:\s*비고)?\s*([\d.]+)\s*%\s*([\d.]+)\s*%/
    ) ??
    compact.match(
      /계획\s*\(%\)\s*실적\s*\(%\)(?:\s*비고)?\s*([\d.]+)\s*%\s*([\d.]+)\s*%/
    ) ??
    compact.match(
      /누계\s*(?:\/)?\s*계획[^\d%]{0,30}([\d.]+)\s*%[^\d%]{0,40}(?:실행|실적)[^\d%]{0,20}([\d.]+)\s*%/
    ) ??
    compact.match(
      /계획[^\d%]{0,10}([\d.]+)\s*%[^\d%]{0,20}(?:실행|실적)[^\d%]{0,10}([\d.]+)\s*%[^\d%]{0,20}(?:달성|대비)/
    );
  if (confirmRow) {
    const planned = Number(confirmRow[1]);
    const actual = Number(confirmRow[2]);
    const achMatch =
      compact.match(/대비\s*\(%\)\s*([\d.]+)\s*%/) ??
      compact.match(/달성\s*률\s*[：:]?\s*([\d.]+)\s*%/) ??
      compact.match(/달성\s*\(%\)\s*([\d.]+)\s*%/);
    const achievement = achMatch ? Number(achMatch[1]) : null;
    return {
      plannedProgressPct: Number.isFinite(planned) ? planned : null,
      actualProgressPct: Number.isFinite(actual) ? actual : null,
      achievementPct:
        achievement != null && Number.isFinite(achievement) ? achievement : null,
    };
  }

  // 공정확인서·간단 표 폴백
  const mgmt = compact.match(/실시\s*\(B\)\s*([\d.]+)\s*%/);
  const plan =
    compact.match(/계획\([^)]*\)\s*\(A\)\s*([\d.]+)\s*%/) ??
    compact.match(/계획\s*\(A\)\s*([\d.]+)\s*%/);
  const planned = plan ? Number(plan[1]) : null;
  const actual = mgmt ? Number(mgmt[1]) : null;
  if (
    (planned != null && Number.isFinite(planned)) ||
    (actual != null && Number.isFinite(actual))
  ) {
    return {
      plannedProgressPct: planned != null && Number.isFinite(planned) ? planned : null,
      actualProgressPct: actual != null && Number.isFinite(actual) ? actual : null,
      achievementPct: null,
    };
  }

  // "누계실적 12.34%" / "실행공정율 12.34%" 단독 표기
  const actualSolo =
    compact.match(/누계\s*실적\s*([\d.]+)\s*%/) ??
    compact.match(/실행\s*공정(?:율)?\s*([\d.]+)\s*%/) ??
    compact.match(/실적\s*공정(?:율)?\s*([\d.]+)\s*%/);
  const plannedSolo =
    compact.match(/누계\s*계획\s*([\d.]+)\s*%/) ??
    compact.match(/계획\s*공정(?:율)?\s*([\d.]+)\s*%/);
  if (actualSolo || plannedSolo) {
    const a = actualSolo ? Number(actualSolo[1]) : null;
    const p = plannedSolo ? Number(plannedSolo[1]) : null;
    return {
      plannedProgressPct: p != null && Number.isFinite(p) ? p : null,
      actualProgressPct: a != null && Number.isFinite(a) ? a : null,
      achievementPct: null,
    };
  }

  return { plannedProgressPct: null, actualProgressPct: null, achievementPct: null };
}

export function extractDelayDays(text: string): {
  delayDays: number | null;
  delayReason: string | null;
} {
  const compact = text.replace(/\s+/g, " ");
  const delay =
    compact.match(/예정공정\s*대비\s*지연일수\s*([\d.]+)\s*일/) ??
    compact.match(/지연일수\s*([\d.]+)\s*일/);
  const delayDays = delay ? Number(delay[1]) : null;

  const reason =
    compact.match(/공기지연\s*사유\s+([^※]{4,80}?)(?:\s+\d+\s*일|\s+공기지연\s*만회|$)/) ??
    compact.match(/공기지연\s*사유\s+([^\n]{4,60})/);

  return {
    delayDays: delayDays != null && Number.isFinite(delayDays) ? delayDays : null,
    delayReason: reason ? reason[1].replace(/\s+/g, " ").trim() : null,
  };
}

export function extractSpecialNotes(text: string): string[] {
  const notes: string[] = [];
  const normalized = text.replace(/\r\n/g, "\n");

  // 공정진행현황 바로 아래 ※ 특이사항 블록
  const blockA = normalized.match(
    /※\s*특이사항\s*\n([\s\S]{20,600}?)(?:\n\s*Ⅱ\.|\n\s*Ⅲ\.|\n\s*3\.\s*공기|$)/
  );
  if (blockA) {
    for (const line of blockA[1].split("\n")) {
      const t = line.replace(/^[①②③④⑤⑥⑦⑧⑨⑩\-\*\d.]+\s*/, "").trim();
      if (t.length >= 8 && !/^Milestone|^공사기간/.test(t)) notes.push(t);
    }
  }

  // Ⅴ. CM검토 종합의견 > 2. 특이사항 (하이픈 bullet)
  const blockB = normalized.match(
    /2\.\s*특이사항\s*\n([\s\S]{20,800}?)(?:\n\s*3\.\s*결론|\n\s*Ⅵ\.|$)/
  );
  if (blockB) {
    const chunk = blockB[1]
      .split(/\n/)
      .map((s) => s.replace(/^[\s\-·]+/, "").replace(/\s+/g, " ").trim())
      .filter((s) => s.length >= 15 && !/^①|^②|^공정/.test(s));
    notes.push(...chunk);
  }

  // 중복 제거
  const seen = new Set<string>();
  return notes.filter((n) => {
    const key = n.slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function summarizeNotes(notes: string[], delayReason: string | null): string | null {
  const parts: string[] = [];
  if (delayReason) parts.push(`지연사유: ${delayReason}`);
  for (const n of notes) {
    if (delayReason && n.includes(delayReason.slice(0, 8))) continue;
    parts.push(n);
  }
  if (parts.length === 0) return null;
  // 최대 3개로 요약
  return parts.slice(0, 3).join(" / ");
}

export function parseGisungReport(rawText: string, fileName: string): GisungExtracted {
  const text = normalizeText(rawText);
  const progress = extractCumulativeProgress(text);
  const delay = extractDelayDays(text);
  const specialNotesRaw = extractSpecialNotes(text);
  const fundRoundHints = extractFundRoundHints(fileName, text);
  const documentKind = inferDocumentKind(fileName, text);
  const permitLabel = permitLabelForKind(documentKind);

  const roundMatch =
    text.match(/제\s*(\d+)\s*회\s*CM\s*기성실사/i) ??
    text.match(/제\s*(\d+)\s*회\s*기성실사/i);

  const labeledDate =
    text.match(/일\s*자\s+(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ??
    text.match(/기표일\s+(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ??
    text.match(/기표일\s+(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/) ??
    text.match(/발급\s*일\s*자?\s*[:：]?\s*(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ??
    text.match(/승인\s*일\s*[:：]?\s*(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  const dateMatch = [...text.matchAll(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)];
  let reportDate: string | null = null;
  const d = labeledDate ?? dateMatch[0] ?? null;
  if (d) {
    reportDate = `${d[1]}-${d[2].padStart(2, "0")}-${d[3].padStart(2, "0")}`;
  }
  if (!reportDate) reportDate = extractDateFromFileName(fileName);

  let specialNotesSummary = summarizeNotes(specialNotesRaw, delay.delayReason);
  if (permitLabel) {
    const withDate = reportDate ? `${permitLabel} (${reportDate})` : permitLabel;
    specialNotesSummary = specialNotesSummary
      ? `${withDate} / ${specialNotesSummary}`
      : withDate;
  }

  // 필증은 공정율 테이블이 아니라 특이사항용 — 잘못된 합계 추출 방지
  const isPermit = isPermitDocumentKind(documentKind);

  return {
    fileName,
    documentKind,
    siteAddress: extractSiteAddress(text, fileName),
    projectName: extractProjectName(text),
    fundRoundHint: fundRoundHints[0] ?? null,
    fundRoundHints,
    fundNameHint: extractFundNameHint(fileName, text),
    operatorHints: extractOperatorHints(text),
    permitLabel,
    reportRound: roundMatch ? Number(roundMatch[1]) : null,
    reportDate,
    plannedProgressPct: isPermit ? null : progress.plannedProgressPct,
    actualProgressPct: isPermit ? null : progress.actualProgressPct,
    achievementPct: isPermit ? null : progress.achievementPct,
    delayDays: isPermit ? null : delay.delayDays,
    delayReason: isPermit ? null : delay.delayReason,
    specialNotesRaw: permitLabel
      ? [permitLabel, ...specialNotesRaw]
      : specialNotesRaw,
    specialNotesSummary,
  };
}
