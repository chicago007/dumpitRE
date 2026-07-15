"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { RequireAdmin } from "@/components/auth/require-admin";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { ProposalRegistrationPanel } from "@/components/upload/proposal-registration-panel";
import { Pill } from "@/components/ui/pill";
import { Badge } from "@/components/ui/badge";
import type { DocumentRecord, DocumentType, ProposalRegistrationPrompt } from "@/lib/types";

export const dynamic = "force-dynamic";

const docTypes: { id: DocumentType; label: string }[] = [
  { id: "management_status", label: "관리현황" },
  { id: "proposal", label: "제안서" },
  { id: "progress_report", label: "공정율" },
  { id: "fund_schedule", label: "자금집행" },
];

const REG_STORAGE_KEY = "dumpitre_pending_proposal_reg_v2";

function isProposalFileName(fileName: string, selectedType: DocumentType): boolean {
  if (selectedType === "proposal") return true;
  const lower = fileName.toLowerCase();
  if (lower.includes("제안") || lower.includes("proposal") || lower.includes("im")) {
    return true;
  }
  return /부동산\s*랩/.test(fileName) || /랩\s*제?\s*\d{1,3}\s*호/.test(fileName) || /\d{1,3}\s*호/.test(fileName);
}

function persistRegistration(reg: ProposalRegistrationPrompt | null) {
  try {
    if (reg) sessionStorage.setItem(REG_STORAGE_KEY, JSON.stringify(reg));
    else sessionStorage.removeItem(REG_STORAGE_KEY);
  } catch {
    /* ignore */
  }
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
      }));
    const numMatch = fileName.match(/(\d{1,3})\s*호/);
    const labNum = numMatch?.[1] ?? null;
    const suggestedLabName = labNum ? `부동산랩 ${labNum}호` : null;
    const matchedLab = labNum
      ? labOptions.find((o) => o.name.includes(`${labNum}호`))
      : null;

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
  const router = useRouter();
  const [docType, setDocType] = useState<DocumentType>("proposal");
  const [uploading, setUploading] = useState(false);
  const [queue, setQueue] = useState<DocumentRecord[]>([]);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [registration, setRegistration] = useState<ProposalRegistrationPrompt | null>(null);
  const [regSaving, setRegSaving] = useState(false);

  const openRegistration = useCallback((pendingReg: ProposalRegistrationPrompt) => {
    persistRegistration(pendingReg);
    setRegistration(pendingReg);
    requestAnimationFrame(() => {
      document.getElementById("proposal-registration")?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/documents?t=${Date.now()}`, { cache: "no-store" });
      const text = await r.text();
      if (!r.ok || !text.trim()) {
        setQueue([]);
        return;
      }
      const parsed: unknown = JSON.parse(text);
      setQueue(Array.isArray(parsed) ? (parsed as DocumentRecord[]) : []);
    } catch (err) {
      console.warn("[upload] documents refresh skipped:", err);
    }
  }, []);

  useEffect(() => {
    void refresh();
    try {
      const raw = sessionStorage.getItem(REG_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as ProposalRegistrationPrompt;
      if (saved?.documentId && Array.isArray(saved.labOptions)) {
        setRegistration(saved);
      }
    } catch {
      /* ignore */
    }
  }, [refresh]);

  async function handleUpload(files: File[]) {
    setUploading(true);
    setLastFeedback(null);
    try {
      let openedReg = false;

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
          document?: DocumentRecord;
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
          openRegistration(reg);
          openedReg = true;
          setLastFeedback(null);
        } else if (looksProposal) {
          setLastFeedback(
            `${file.name}: 제안서로 인식했지만 선택 화면을 열지 못했습니다. 문서 유형을 「제안서」로 선택 후 다시 업로드해 주세요.`
          );
        } else {
          setLastFeedback(`${file.name}: ${(data.message ?? "업로드 완료").split("\n")[0]}`);
        }

        if (!openedReg && docType === "management_status") {
          router.push("/management");
        }
      }

      void refresh();
    } finally {
      setUploading(false);
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
      setLastFeedback(
        [
          data.message,
          ...(data.applied ?? []).map((a: string) => `· ${a}`),
          "전체현황에서 확인할 수 있습니다.",
        ].join("\n")
      );
      persistRegistration(null);
      setRegistration(null);
      void refresh();
      router.push("/management");
    } finally {
      setRegSaving(false);
    }
  }

  return (
    <RequireAdmin>
      <AppShell title="관리자 · 문서 업로드">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <p className="text-sm text-muted">
              제안서 PDF 업로드 → <strong>아래에서 신규/기존 선택</strong> → 「저장하고 전체현황에
              반영」을 눌러야 데이터가 바뀝니다. 업로드만으로는 반영되지 않습니다.
            </p>

            {registration ? (
              <ProposalRegistrationPanel
                registration={registration}
                saving={regSaving}
                onClose={() => {
                  persistRegistration(null);
                  setRegistration(null);
                }}
                onConfirm={confirmRegistration}
              />
            ) : null}

            <UploadDropzone onUpload={handleUpload} uploading={uploading} />

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
              <Link href="/management" className="text-accent underline">
                전체 현황
              </Link>
            </p>

            {lastFeedback && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm whitespace-pre-wrap text-amber-950">
                {lastFeedback}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">업로드 큐</h3>
            <div className="space-y-3">
              {queue.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{item.fileName}</p>
                      <p className="text-xs text-muted">{item.siteName ?? "선택 대기"}</p>
                    </div>
                    <Badge variant={item.analysisStatus === "done" ? "success" : "default"}>
                      {statusLabel(item.analysisStatus)}
                    </Badge>
                  </div>
                </div>
              ))}
              {queue.length === 0 && (
                <p className="text-sm text-muted">업로드된 문서가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    </RequireAdmin>
  );
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: "대기",
    processing: "분석 중",
    done: "분석 완료",
    failed: "실패",
    needs_review: "선택 대기",
  };
  return map[s] ?? s;
}
