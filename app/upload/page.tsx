"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { UploadDropzone } from "@/components/upload/upload-dropzone";
import { Pill } from "@/components/ui/pill";
import { Badge } from "@/components/ui/badge";
import type { DocumentRecord, DocumentType } from "@/lib/types";

const docTypes: { id: DocumentType; label: string }[] = [
  { id: "proposal", label: "제안서" },
  { id: "progress_report", label: "공정율" },
  { id: "fund_schedule", label: "자금집행" },
];

export default function UploadPage() {
  const [docType, setDocType] = useState<DocumentType>("progress_report");
  const [uploading, setUploading] = useState(false);
  const [queue, setQueue] = useState<DocumentRecord[]>([]);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then(setQueue)
      .catch(console.error);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleUpload(files: File[]) {
    setUploading(true);
    try {
      const messages: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        form.append("type", docType);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (data.message) messages.push(`${file.name}: ${data.message}`);
      }
      setLastFeedback(messages.join("\n"));
      refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppShell title="문서 업로드">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <UploadDropzone onUpload={handleUpload} uploading={uploading} />

          <div>
            <p className="mb-2 text-sm font-medium">문서 유형</p>
            <div className="flex gap-2">
              {docTypes.map((t) => (
                <Pill key={t.id} active={docType === t.id} onClick={() => setDocType(t.id)}>
                  {t.label}
                </Pill>
              ))}
            </div>
          </div>

          <p className="text-sm text-muted">
            COST CM 기성실사 PDF 업로드 시 공정율·기성률을 자동 추출해 사업장 데이터에 반영합니다.
            원본은 uploads/ 폴더에 저장됩니다.
          </p>
          {lastFeedback && (
            <div className="rounded-lg border border-border bg-neutral-50 p-3 text-sm whitespace-pre-wrap">
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
                    <p className="text-xs text-muted">{item.siteName ?? "사업장 매칭 중"}</p>
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
  );
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: "대기",
    processing: "분석 중",
    done: "분석 완료",
    failed: "실패",
    needs_review: "검수 필요",
  };
  return map[s] ?? s;
}
