"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { RequireAdmin } from "@/components/auth/require-admin";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { ProposalRegistrationPanel } from "@/components/upload/proposal-registration-panel";
import { ProposalConditionsTable } from "@/components/upload/proposal-conditions-table";
import { ProgressMatchPanel } from "@/components/upload/progress-match-panel";
import { Pill } from "@/components/ui/pill";
import type {
  DocumentType,
  LabProgressApplyResult,
  ProposalRegistrationPrompt,
} from "@/lib/types";
import type { ParsedProposal } from "@/lib/analyzers/proposal";

export const dynamic = "force-dynamic";

const docTypes: { id: DocumentType; label: string }[] = [
  { id: "management_status", label: "관리현황" },
  { id: "proposal", label: "제안서" },
  { id: "progress_report", label: "공정율" },
];

const REG_STORAGE_KEY = "dumpitre_pending_proposal_regs_v3";
const PROGRESS_PENDING_KEY = "dumpitre_pending_progress_match_v1";
const STALE_PENDING_KEY = "dumpitre_pending_progress_stale_v1";

function isProgressExtractionFailed(lp: LabProgressApplyResult | undefined): boolean {
  if (!lp?.row) return false;
  return (
    lp.row.actualProgressPct == null &&
    lp.row.plannedProgressPct == null &&
    !lp.row.specialNotes?.includes("필증")
  );
}

const EMPTY_PARSED: ParsedProposal = {
  siteName: null,
  fundName: null,
  labName: null,
  totalBudget: null,
  constructionPeriod: null,
  location: null,
  setupDate: null,
  maturityDate: null,
  loanMaturityDate: null,
  interestRate: null,
  feeRate: null,
  purchaseAgency: null,
  developer: null,
  contractor: null,
  trustCompany: null,
  trustType: null,
  businessDesc: null,
  landArea: null,
  buildingArea: null,
  totalFloorArea: null,
  buildingScale: null,
  householdCount: null,
  highlights: [],
};

function isProposalFileName(fileName: string, selectedType: DocumentType): boolean {
  if (selectedType === "proposal") return true;
  const lower = fileName.toLowerCase();
  if (lower.includes("제안") || lower.includes("proposal") || lower.includes("im")) {
    return true;
  }
  return /부동산\s*랩/.test(fileName) || /랩\s*제?\s*\d{1,3}\s*호/.test(fileName) || /\d{1,3}\s*호/.test(fileName);
}

function persistRegistrations(regs: ProposalRegistrationPrompt[]) {
  try {
    if (regs.length) sessionStorage.setItem(REG_STORAGE_KEY, JSON.stringify(regs));
    else sessionStorage.removeItem(REG_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function upsertRegistrations(
  prev: ProposalRegistrationPrompt[],
  next: ProposalRegistrationPrompt[]
): ProposalRegistrationPrompt[] {
  const map = new Map(prev.map((r) => [r.documentId, r]));
  for (const r of next) map.set(r.documentId, r);
  return Array.from(map.values());
}

async function buildFallbackRegistration(
  documentId: string,
  fileName: string
): Promise<ProposalRegistrationPrompt | null> {
  try {
    const res = await fetch("/api/lab-portfolio", { cache: "no-store" });
    if (!res.ok) return null;
    const portfolio = (await res.json()) as {
      funds?: Array<{
        id: string;
        name: string;
        fundName: string | null;
        siteAddress: string | null;
      }>;
    };
    const labOptions = (portfolio.funds ?? [])
      .filter((f) => f.name?.trim())
      .map((f) => ({
        id: f.id,
        name: f.name,
        fundName: f.fundName,
        siteAddress: f.siteAddress,
      }))
      .sort((a, b) => {
        const na = Number(a.name.match(/(\d+)\s*호/)?.[1] ?? 0);
        const nb = Number(b.name.match(/(\d+)\s*호/)?.[1] ?? 0);
        return nb - na;
      });
    const numMatch = fileName.match(/(\d{1,3})\s*호/);
    const labNum = numMatch?.[1] ?? null;
    const suggestedLabName = labNum ? `부동산랩 ${labNum}호` : null;
    const matchedLab = labNum
      ? labOptions.find((o) => o.name.includes(`${labNum}호`))
      : null;

    const parsed: ParsedProposal = {
      ...EMPTY_PARSED,
      labName: suggestedLabName,
      location: matchedLab?.siteAddress ?? null,
    };

    return {
      documentId,
      fileName,
      suggestedSiteName: null,
      suggestedFundName: null,
      suggestedLabName,
      suggestedLocation: matchedLab?.siteAddress ?? null,
      suggestedBudget: null,
      matchedProductId: null,
      matchedLabFundId: matchedLab?.id ?? null,
      matchedLabel: matchedLab?.name ?? null,
      labOptions,
      question:
        "이 제안서를 신규 부동산랩으로 등록할까요, 아니면 기존 목록에 반영할까요?",
      parsed,
      extractionSource: "regex",
      extractionWarning: "상세 조건은 Gemini 보강이 필요합니다.",
    };
  } catch {
    return null;
  }
}

async function fetchPendingRegistration(
  documentId: string
): Promise<ProposalRegistrationPrompt | null> {
  const res = await fetch(
    `/api/upload/pending-registration?documentId=${encodeURIComponent(documentId)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { registration?: ProposalRegistrationPrompt | null };
  return data.registration ?? null;
}

export default function UploadPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted">불러오는 중…</p>}>
      <UploadPageInner />
    </Suspense>
  );
}

function UploadPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [docType, setDocType] = useState<DocumentType>("proposal");
  const [uploading, setUploading] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<ProposalRegistrationPrompt[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [regSaving, setRegSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [stalePrompt, setStalePrompt] = useState<LabProgressApplyResult | null>(null);
  const [staleApplying, setStaleApplying] = useState(false);
  const [progressPending, setProgressPending] = useState<LabProgressApplyResult[]>([]);
  const [progressLabs, setProgressLabs] = useState<
    { id: string; name: string; fundName: string | null; siteAddress: string | null }[]
  >([]);
  const [progressSaving, setProgressSaving] = useState(false);

  const registration =
    registrations.find((r) => r.documentId === activeDocumentId) ??
    registrations[0] ??
    null;

  const activeProgressPending = progressPending[0] ?? null;

  const setRegs = useCallback((next: ProposalRegistrationPrompt[]) => {
    persistRegistrations(next);
    setRegistrations(next);
    setActiveDocumentId((prev) => {
      if (prev && next.some((r) => r.documentId === prev)) return prev;
      return next[0]?.documentId ?? null;
    });
  }, []);

  const setProgressQueue = useCallback((next: LabProgressApplyResult[]) => {
    setProgressPending(next);
    try {
      sessionStorage.setItem(PROGRESS_PENDING_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(REG_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as ProposalRegistrationPrompt[];
        if (Array.isArray(saved) && saved.length && saved.every((s) => s?.documentId && s.parsed)) {
          setRegistrations(saved);
          setActiveDocumentId(saved[0].documentId);
        }
      }
    } catch {
      /* ignore */
    }
    try {
      const raw = sessionStorage.getItem(PROGRESS_PENDING_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as LabProgressApplyResult[];
        if (Array.isArray(saved) && saved.length) setProgressPending(saved);
      }
    } catch {
      /* ignore */
    }
    try {
      const staleRaw = sessionStorage.getItem(STALE_PENDING_KEY);
      if (staleRaw) {
        const saved = JSON.parse(staleRaw) as LabProgressApplyResult;
        if (saved?.action === "stale" && saved.row) {
          setStalePrompt(saved);
          sessionStorage.removeItem(STALE_PENDING_KEY);
        }
      }
    } catch {
      /* ignore */
    }
    fetch("/api/lab-portfolio", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const funds = Array.isArray(data?.funds) ? data.funds : [];
        setProgressLabs(
          funds
            .map(
              (f: {
                id: string;
                name: string;
                fundName: string | null;
                siteAddress: string | null;
              }) => ({
                id: f.id,
                name: f.name,
                fundName: f.fundName,
                siteAddress: f.siteAddress,
              })
            )
            .sort((a: { name: string }, b: { name: string }) => {
              const na = Number(a.name.match(/(\d+)\s*호/)?.[1] ?? 0);
              const nb = Number(b.name.match(/(\d+)\s*호/)?.[1] ?? 0);
              return nb - na;
            })
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (searchParams.get("focus") !== "progress") return;
    setDocType("progress_report");
    const t = window.setTimeout(() => {
      document
        .getElementById("progress-match")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [searchParams, progressPending.length, stalePrompt]);

  async function enrichRegistrations(regs: ProposalRegistrationPrompt[]) {
    if (regs.length === 0) return;
    setEnriching(true);
    try {
      const res = await fetch("/api/upload/enrich-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: regs.map((r) => r.documentId) }),
      });
      const data = (await res.json()) as {
        registrations?: ProposalRegistrationPrompt[];
        error?: string;
      };
      if (!res.ok) {
        setLastFeedback(data.error ?? "조건 보강 실패");
        return;
      }
      if (data.registrations?.length) {
        setRegs(upsertRegistrations(regs, data.registrations));
      }
    } catch (err) {
      setLastFeedback(
        err instanceof Error ? err.message : "조건 보강 중 오류가 발생했습니다."
      );
    } finally {
      setEnriching(false);
    }
  }

  async function handleUpload(files: File[]) {
    setUploading(true);
    setLastFeedback(null);
    try {
      const collected: ProposalRegistrationPrompt[] = [];
      const unmatchedProgress: LabProgressApplyResult[] = [];
      let progressOkCount = 0;

      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        form.append("type", docType);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: form,
          cache: "no-store",
        });
        const text = await res.text();
        let data: {
          message?: string;
          registration?: ProposalRegistrationPrompt;
          requiresRegistration?: boolean;
          document?: { id?: string };
          labProgress?: LabProgressApplyResult;
          redirectTo?: string;
          error?: string;
        } = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          setLastFeedback(`${file.name}: 서버 응답을 파싱하지 못했습니다.`);
          continue;
        }
        if (!res.ok) {
          setLastFeedback(`${file.name}: ${data.error ?? data.message ?? `업로드 실패 (${res.status})`}`);
          continue;
        }

        const docId = data.document?.id;
        const looksProposal = isProposalFileName(file.name, docType);

        let reg = data.registration ?? null;
        if (!reg && looksProposal && docId) {
          reg = (await fetchPendingRegistration(docId)) ?? (await buildFallbackRegistration(docId, file.name));
        }

        if (reg) {
          collected.push(reg);
        } else if (data.labProgress?.action === "stale") {
          setStalePrompt(data.labProgress);
          setLastFeedback(data.labProgress.message);
        } else if (
          data.labProgress?.action === "unmatched" ||
          isProgressExtractionFailed(data.labProgress)
        ) {
          unmatchedProgress.push({
            ...data.labProgress!,
            action: "unmatched",
            needsConfirmation: true,
            message: isProgressExtractionFailed(data.labProgress)
              ? data.labProgress?.message ||
                "공정율을 추출하지 못했습니다. 랩을 선택한 뒤 공정율 현황에서 수치를 입력하세요."
              : data.labProgress!.message,
          });
        } else if (
          data.labProgress?.action === "created" ||
          data.labProgress?.action === "updated"
        ) {
          progressOkCount += 1;
        } else if (looksProposal && docType !== "progress_report") {
          setLastFeedback(
            `${file.name}: 제안서로 인식했지만 선택 화면을 열지 못했습니다. 문서 유형을 「제안서」로 선택 후 다시 업로드해 주세요.`
          );
        } else {
          setLastFeedback(`${file.name}: ${(data.message ?? "업로드 완료").split("\n")[0]}`);
        }

        if (collected.length === 0 && docType === "management_status") {
          router.push("/admin/portfolio");
          return;
        }

        if (
          data.redirectTo &&
          docType === "progress_report" &&
          !data.registration &&
          data.labProgress?.action !== "unmatched" &&
          data.labProgress?.action !== "stale" &&
          !isProgressExtractionFailed(data.labProgress)
        ) {
          router.push(data.redirectTo);
          return;
        }
      }

      if (unmatchedProgress.length) {
        setProgressQueue([...progressPending, ...unmatchedProgress]);
        setLastFeedback(
          `${unmatchedProgress.length}건은 자동 매칭되지 않았습니다. 아래에서 기존 부동산랩을 선택해 주세요.` +
            (progressOkCount ? ` (자동 반영 ${progressOkCount}건)` : "")
        );
      } else if (progressOkCount > 0 && collected.length === 0) {
        setLastFeedback(`${progressOkCount}건 공정율을 반영했습니다.`);
        router.push("/admin/progress");
      }

      if (collected.length) {
        const merged = upsertRegistrations(registrations, collected);
        setRegs(merged);
        setLastFeedback(
          collected.length > 1
            ? `${collected.length}건 제안서 업로드 · 조건 비교표를 확인하세요.`
            : null
        );
        void enrichRegistrations(merged);
        requestAnimationFrame(() => {
          document.getElementById("proposal-conditions")?.scrollIntoView({ behavior: "smooth" });
        });
      }
    } finally {
      setUploading(false);
    }
  }

  async function confirmStaleProgress() {
    if (!stalePrompt?.row) return;
    setStaleApplying(true);
    try {
      const res = await fetch("/api/lab-progress/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row: stalePrompt.row, force: true }),
      });
      const data = (await res.json()) as LabProgressApplyResult & { error?: string };
      if (!res.ok) {
        setLastFeedback(data.error ?? "공정율 반영 실패");
        return;
      }
      setStalePrompt(null);
      setLastFeedback(data.message ?? "이전 자료로 덮어썼습니다.");
      router.push("/admin/progress");
    } catch (err) {
      setLastFeedback(err instanceof Error ? err.message : "반영 중 오류");
    } finally {
      setStaleApplying(false);
    }
  }

  async function confirmProgressMatch(labFundId: string) {
    if (!activeProgressPending?.row) return;
    setProgressSaving(true);
    try {
      const res = await fetch("/api/lab-progress/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          row: activeProgressPending.row,
          labFundId,
          force: true,
        }),
      });
      const data = (await res.json()) as LabProgressApplyResult & { error?: string };
      if (!res.ok || data.action === "unmatched") {
        setLastFeedback(data.error ?? data.message ?? "공정율 반영 실패");
        return;
      }
      const remaining = progressPending.slice(1);
      setProgressQueue(remaining);
      setLastFeedback(
        `${data.message ?? "저장됨"}` +
          (remaining.length ? ` · 남은 매칭 ${remaining.length}건` : "")
      );
      if (remaining.length === 0) {
        router.push("/admin/progress");
      }
    } catch (err) {
      setLastFeedback(err instanceof Error ? err.message : "반영 중 오류");
    } finally {
      setProgressSaving(false);
    }
  }

  async function confirmRegistration(input: {
    mode: "new" | "existing";
    labFundId: string;
    newLabName: string;
  }) {
    if (!registration) return;

    const selected = registration.labOptions.find((o) => o.id === input.labFundId);

    setRegSaving(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: registration.documentId,
          isNewSite: input.mode === "new",
          labFundId: input.mode === "existing" ? input.labFundId : null,
          id: registration.matchedProductId,
          labName:
            input.mode === "existing" ? selected?.name ?? "" : input.newLabName.trim(),
          fundName:
            input.mode === "existing"
              ? selected?.fundName ?? null
              : registration.suggestedFundName,
          siteAddress:
            input.mode === "existing"
              ? selected?.siteAddress ?? ""
              : registration.suggestedLocation ?? "",
          siteName:
            input.mode === "existing"
              ? selected?.name ?? ""
              : registration.suggestedSiteName || input.newLabName.trim(),
          contractAmount: registration.suggestedBudget,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLastFeedback(data.error ?? "등록 실패");
        return;
      }

      const remaining = registrations.filter(
        (r) => r.documentId !== registration.documentId
      );
      setRegs(remaining);

      setLastFeedback(
        [
          data.message,
          ...(data.applied ?? []).map((a: string) => `· ${a}`),
          remaining.length
            ? `남은 제안서 ${remaining.length}건 — 아래에서 이어서 등록하세요.`
            : "사업장관리에서 확인할 수 있습니다.",
        ].join("\n")
      );

      if (remaining.length === 0) {
        router.push("/admin/portfolio");
      }
    } finally {
      setRegSaving(false);
    }
  }

  return (
    <RequireAdmin>
      <AppShell title="관리자 · 문서 업로드">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="space-y-6">
            <p className="text-sm text-muted">
              제안서 PDF 업로드 → <strong>조건 비교표 확인</strong> → 아래에서 신규/기존 선택 →
              「저장하고 공정율 현황에 반영」. 여러 건을 올리면 조건을 표로 비교·CSV로 받을 수
              있습니다. 수동 확인이 필요한 건은{" "}
              <Link href="/admin/review" className="text-accent underline">
                검토 대기함
              </Link>
              에서 이어서 처리할 수 있습니다.
            </p>

            {activeProgressPending ? (
              <div id="progress-match" className="space-y-3">
                <p className="text-xs text-muted">
                  공정율 수동 매칭 {progressPending.length}건 대기 중 · 제안서 등록 화면과
                  다릅니다. 여기서 기존 부동산랩을 고르면 공정율 테이블에 저장됩니다.
                </p>
                <ProgressMatchPanel
                  item={activeProgressPending}
                  labs={progressLabs}
                  saving={progressSaving}
                  onClose={() => {
                    // 버리지 않음 — 맨 뒤로 보내 대기열 유지
                    if (progressPending.length <= 1) return;
                    setProgressQueue([
                      ...progressPending.slice(1),
                      progressPending[0],
                    ]);
                  }}
                  onDefer={() => {
                    if (progressPending.length <= 1) {
                      setLastFeedback(
                        "대기 중인 공정율 매칭이 1건입니다. 선택하거나 페이지를 나가도 세션에 보관됩니다."
                      );
                      return;
                    }
                    setProgressQueue([
                      ...progressPending.slice(1),
                      progressPending[0],
                    ]);
                    setLastFeedback(
                      `다음 건으로 넘겼습니다. 대기열 ${progressPending.length}건 유지`
                    );
                  }}
                  onConfirm={(labFundId) => void confirmProgressMatch(labFundId)}
                />
              </div>
            ) : null}

            {registrations.length > 0 ? (
              <div id="proposal-conditions" className="space-y-4">
                <ProposalConditionsTable
                  registrations={registrations}
                  enriching={enriching || uploading}
                  onEnrich={() => void enrichRegistrations(registrations)}
                  selectedDocumentId={activeDocumentId}
                  onSelect={setActiveDocumentId}
                />
                {registration ? (
                  <ProposalRegistrationPanel
                    registration={registration}
                    saving={regSaving}
                    onClose={() => {
                      const remaining = registrations.filter(
                        (r) => r.documentId !== registration.documentId
                      );
                      setRegs(remaining);
                    }}
                    onConfirm={confirmRegistration}
                  />
                ) : null}
                {registrations.length > 1 ? (
                  <p className="text-xs text-muted">
                    표에서 열을 클릭하면 해당 제안서의 등록 패널로 전환됩니다. (
                    {registrations.findIndex((r) => r.documentId === registration?.documentId) + 1}
                    /{registrations.length})
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <UploadDropzone onUpload={handleUpload} uploading={uploading || enriching} />

            <div>
              <p className="mb-2 text-sm font-medium">문서 유형</p>
              <div className="flex flex-wrap gap-2">
                <Pill active={docType === "other"} onClick={() => setDocType("other")}>
                  자동 인식
                </Pill>
                {docTypes.map((t) => (
                  <Pill key={t.id} active={docType === t.id} onClick={() => setDocType(t.id)}>
                    {t.label}
                  </Pill>
                ))}
              </div>
            </div>

            <p className="text-sm text-muted">
              관리현황 엑셀 →{" "}
              <Link href="/admin/portfolio" className="text-accent underline">
                사업장관리
              </Link>
              {" · "}
              기성보고서 →{" "}
              <Link href="/admin/progress" className="text-accent underline">
                공정율 현황
              </Link>
            </p>

            {stalePrompt?.action === "stale" && stalePrompt.row ? (
              <div className="rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-medium">{stalePrompt.message}</p>
                <p className="mt-2 text-xs">
                  보관: 확인일 {stalePrompt.existing?.confirmedDate ?? "—"} · 업로드:{" "}
                  {stalePrompt.row.confirmedDate ?? "—"} ({stalePrompt.row.labName})
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={staleApplying}
                    onClick={() => void confirmStaleProgress()}
                    className="rounded-md bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-900 disabled:opacity-50"
                  >
                    예, 업로드 자료로 덮어쓰기
                  </button>
                  <button
                    type="button"
                    disabled={staleApplying}
                    onClick={() => setStalePrompt(null)}
                    className="rounded-md border border-amber-600 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  >
                    아니오, 유지
                  </button>
                </div>
              </div>
            ) : null}

            {lastFeedback && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm whitespace-pre-wrap text-amber-950">
                {lastFeedback}
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </RequireAdmin>
  );
}
