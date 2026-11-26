"use client";

import { useRef, useState } from "react";
import { Download, Eye, FileText, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ClassificationBadge,
  ClassificationSelect,
} from "@/features/uploads/components/classification-select";
import { OnlyOfficeViewer } from "@/features/uploads/components/onlyoffice-viewer";
import {
  ACCEPT_UPLOAD,
  MAX_UPLOAD_BYTES,
  canOpenInOnlyOffice,
  downloadAttachment,
  uploadFile,
  type DocumentClassification,
} from "@/features/uploads/api";
import type { TaskAttachment } from "@/features/tasks/api";
import { getApiErrorMessage } from "@/lib/api-client";

function sizeLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Danh sách tệp: xem trực tiếp (OnlyOffice) / tải về / bỏ. */
export function AttachmentList({
  items,
  onRemove,
}: {
  items: TaskAttachment[];
  onRemove?: (id: string) => void;
}) {
  const [viewing, setViewing] = useState<{ uploadId: string; name: string } | null>(null);

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Không có tệp đính kèm.</p>;
  }
  return (
    <>
      <ul className="min-w-0 divide-y rounded-md border">
        {items.map((file) => (
          <li key={file.id} className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate" title={file.name}>
              {file.name}
            </span>
            <ClassificationBadge value={file.classification} />
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {sizeLabel(file.size)}
            </span>
            {canOpenInOnlyOffice(file.name) ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Xem ${file.name}`}
                onClick={() => setViewing({ uploadId: file.id, name: file.name })}
              >
                <Eye className="size-4" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`Tải ${file.name}`}
              onClick={() =>
                downloadAttachment(file).catch((err) =>
                  toast.error(getApiErrorMessage(err, "Không tải được tệp.")),
                )
              }
            >
              <Download className="size-4" />
            </Button>
            {onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Bỏ ${file.name}`}
                onClick={() => onRemove(file.id)}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <OnlyOfficeViewer file={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

/** Ô đính kèm trong form: chọn độ mật → chọn tệp → tải lên ngay. */
export function AttachmentsField({
  value,
  onChange,
  disabled,
}: {
  value: TaskAttachment[];
  onChange: (next: TaskAttachment[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [classification, setClassification] = useState<DocumentClassification | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const pick = async (file?: File) => {
    if (!file || !classification) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Tệp vượt quá 10MB.");
      return;
    }
    setProgress(0);
    try {
      const uploaded = await uploadFile(file, classification, setProgress);
      onChange([...value, uploaded]);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được tệp lên."));
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="min-w-0 space-y-2">
      <ClassificationSelect
        value={classification}
        onChange={setClassification}
        disabled={disabled || progress !== null}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !classification || progress !== null}
            onClick={() => inputRef.current?.click()}
          >
            {progress !== null ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Paperclip className="size-4" />
            )}
            {progress !== null ? `Đang tải ${progress}%` : "Đính kèm tệp"}
          </Button>
        }
      />
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={ACCEPT_UPLOAD}
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {value.length ? (
        <AttachmentList
          items={value}
          onRemove={disabled ? undefined : (id) => onChange(value.filter((f) => f.id !== id))}
        />
      ) : null}
    </div>
  );
}
