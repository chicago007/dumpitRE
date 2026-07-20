"use client";

import { useCallback, useState } from "react";
import { Upload as UploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onUpload: (files: File[]) => Promise<void>;
  uploading: boolean;
}

export function UploadDropzone({ onUpload, uploading }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      await onUpload(Array.from(files));
    },
    [onUpload]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors",
        dragging ? "border-accent bg-blue-50/50" : "border-border bg-neutral-50"
      )}
    >
      <UploadIcon className="mb-3 h-8 w-8 text-muted" />
      <p className="font-medium">파일을 여기에 드래그</p>
      <p className="mt-1 text-sm text-muted">
        PDF, PNG/JPG, XLSX · 최대 50MB · 다중 업로드
      </p>
      <label className="mt-4 cursor-pointer">
        <input
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls"
          disabled={uploading}
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <span
          className={cn(
            "inline-flex h-9 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-medium",
            uploading && "opacity-50"
          )}
        >
          {uploading ? "업로드 중…" : "파일 선택"}
        </span>
      </label>
    </div>
  );
}
