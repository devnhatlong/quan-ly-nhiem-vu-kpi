"use client";

import { useState, type ReactNode } from "react";
import { MessageSquare, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  FIELD_LABELS,
  HISTORY_LABELS,
  commentTask,
  type TaskAttachment,
  type TaskHistoryEntry,
} from "@/features/tasks/api";
import {
  AttachmentList,
  AttachmentsField,
} from "@/features/tasks/components/attachments-field";
import { getApiErrorMessage } from "@/lib/api-client";
import { serverDayjs } from "@/lib/server-time";
import { cn } from "@/lib/utils";

const DOT: Record<TaskHistoryEntry["action"], string> = {
  CREATED: "bg-sky-500",
  UPDATED: "bg-slate-400",
  SUBMITTED: "bg-amber-500",
  APPROVED_STEP: "bg-emerald-400",
  APPROVED: "bg-emerald-600",
  RETURNED: "bg-rose-500",
  CANCELLED: "bg-slate-500",
  FORWARDED: "bg-violet-500",
  RECALLED: "bg-violet-400",
  PROGRESS: "bg-sky-400",
  REPORTED: "bg-amber-500",
  COMMENT: "bg-primary",
  PART_DONE: "bg-emerald-500",
  PART_UNDONE: "bg-slate-400",
};

function when(value: string) {
  return serverDayjs(value).format("HH:mm DD/MM/YYYY");
}

/** Ô nhập ý kiến - ai xem được nhiệm vụ đều cho ý kiến được. */
function CommentBox({ taskId, onSent }: { taskId: string; onSent: () => void }) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<TaskAttachment[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!note.trim()) return toast.error("Vui lòng nhập ý kiến.");
    setSending(true);
    try {
      await commentTask(taskId, { note: note.trim(), attachmentIds: files.map((f) => f.id) });
      setNote("");
      setFiles([]);
      setAttaching(false);
      onSent();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không gửi được ý kiến."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-w-0 space-y-2 rounded-lg border bg-muted/30 p-3">
      <Textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Cho ý kiến, trao đổi về nhiệm vụ..."
        className="bg-background"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send();
        }}
      />
      {attaching ? <AttachmentsField value={files} onChange={setFiles} disabled={sending} /> : null}
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="bg-background"
          onClick={() => setAttaching((v) => !v)}
        >
          <Paperclip className="size-4" />
          {attaching ? "Ẩn đính kèm" : "Đính kèm"}
        </Button>
        <Button size="sm" onClick={() => void send()} disabled={sending || !note.trim()}>
          <Send className="size-4" />
          {sending ? "Đang gửi..." : "Gửi ý kiến"}
        </Button>
      </div>
    </div>
  );
}

/** Một dòng "Tên trường: giá trị" - tên trường đậm. */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="mt-1 whitespace-pre-line break-words text-sm">
      <span className="font-medium text-foreground">{label}:</span>{" "}
      <span className="text-muted-foreground">{children}</span>
    </p>
  );
}

/**
 * Ghi chú hệ thống: mỗi dòng "Tên: giá trị" tô đậm phần tên. Dòng không theo
 * mẫu (dữ liệu cũ, hoặc phần tiếp của nội dung nhiều dòng) giữ nguyên.
 */
function NoteLines({ note }: { note: string }) {
  return (
    <>
      {note.split("\n").map((raw, i) => {
        const m = /^([^:]{1,40}):\s(.*)$/.exec(raw);
        return m ? (
          <Line key={i} label={m[1]}>
            {m[2]}
          </Line>
        ) : (
          <p key={i} className="mt-1 whitespace-pre-line break-words text-sm text-muted-foreground">
            {raw}
          </p>
        );
      })}
    </>
  );
}

function Entry({ h }: { h: TaskHistoryEntry }) {
  const comment = h.action === "COMMENT";
  const progress = h.changes.find((c) => c.field === "progress");
  return (
    <li className="relative min-w-0">
      <span
        className={cn(
          "absolute -left-[26px] top-1.5 size-2.5 rounded-full ring-4 ring-card",
          DOT[h.action],
        )}
      />
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="inline-flex items-center gap-1 font-medium">
          {comment ? <MessageSquare className="size-3.5 text-primary" /> : null}
          {HISTORY_LABELS[h.action]}
        </span>
        <span className="text-muted-foreground">· {h.actorName}</span>
      </div>
      <div className="text-xs tabular-nums text-muted-foreground">{when(h.at)}</div>

      {progress ? (
        <Line label="Tiến độ">
          <span className="rounded bg-sky-100 px-1.5 font-semibold tabular-nums text-sky-800 dark:bg-sky-950 dark:text-sky-200">
            {progress.from} → {progress.to}
          </span>
        </Line>
      ) : null}

      {h.note ? (
        comment ? (
          <p className="mt-1 whitespace-pre-line break-words rounded-lg rounded-tl-none bg-muted px-3 py-2 text-sm text-foreground">
            {h.note}
          </p>
        ) : h.action === "PROGRESS" ? (
          <Line label="Nội dung đã làm">{h.note}</Line>
        ) : (
          <NoteLines note={h.note} />
        )
      ) : null}

      {h.changes
        .filter((c) => c.field !== "progress")
        .map((c, i) => (
          <Line key={i} label={FIELD_LABELS[c.field] ?? c.field}>
            <span className="text-muted-foreground line-through">{c.from || "(trống)"}</span>{" "}
            → {c.to || "(trống)"}
          </Line>
        ))}
      {h.attachments?.length ? (
        <div className="mt-2">
          <AttachmentList items={h.attachments} />
        </div>
      ) : null}
    </li>
  );
}

/** Dòng thời gian: mới nhất ở trên, ô ý kiến ở đầu. */
export function TaskTimeline({
  taskId,
  items,
  canComment,
  onChanged,
}: {
  taskId: string;
  items: TaskHistoryEntry[];
  canComment: boolean;
  onChanged: () => void;
}) {
  const ordered = [...items].reverse();
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      {canComment ? (
        <div className="shrink-0">
          <CommentBox taskId={taskId} onSent={onChanged} />
        </div>
      ) : null}
      {/* Cuộn riêng danh sách; chừa lề trái cho chấm mốc khỏi bị cắt. */}
      <div className="-mr-3 min-h-0 flex-1 overflow-y-auto pl-2 pr-3 [scrollbar-gutter:stable]">
        <ol className="relative ml-1.5 space-y-4 border-l pb-1 pl-5 pt-1">
          {ordered.map((h) => (
            <Entry key={h._id} h={h} />
          ))}
        </ol>
      </div>
    </div>
  );
}
