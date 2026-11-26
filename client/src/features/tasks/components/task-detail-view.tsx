"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Pencil,
  Send,
  Undo2,
} from "lucide-react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EVALUATION_LABELS,
  FIELD_LABELS,
  HISTORY_LABELS,
  PRIORITY_LABELS,
  TYPE_LABELS,
  fetchTask,
  personName,
  reviewStepText,
  submitTask,
  taskKeys,
  type TaskHistoryEntry,
} from "@/features/tasks/api";
import { AssignTaskDialog } from "@/features/tasks/components/assign-task-dialog";
import { AttachmentList } from "@/features/tasks/components/attachments-field";
import {
  ApproveDialog,
  CancelDialog,
  ReturnDialog,
} from "@/features/tasks/components/review-dialogs";
import { SelfReportDialog } from "@/features/tasks/components/self-report-dialog";
import { TaskInfoCard } from "@/features/tasks/components/task-info-card";
import {
  OverdueTag,
  StatusBadge,
  isOverdue,
} from "@/features/tasks/components/task-badges";
import { getApiErrorMessage } from "@/lib/api-client";
import { serverDayjs } from "@/lib/server-time";
import { cn } from "@/lib/utils";

function when(value?: string | null) {
  return value ? serverDayjs(value).format("HH:mm DD/MM/YYYY") : "-";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

const DOT: Record<TaskHistoryEntry["action"], string> = {
  CREATED: "bg-sky-500",
  UPDATED: "bg-slate-400",
  SUBMITTED: "bg-amber-500",
  APPROVED_STEP: "bg-emerald-400",
  APPROVED: "bg-emerald-600",
  RETURNED: "bg-rose-500",
  CANCELLED: "bg-slate-500",
};

function HistoryTimeline({ items }: { items: TaskHistoryEntry[] }) {
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {items.map((h) => (
        <li key={h._id} className="relative">
          <span
            className={cn(
              "absolute -left-[26px] top-1.5 size-2.5 rounded-full ring-4 ring-card",
              DOT[h.action],
            )}
          />
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium">{HISTORY_LABELS[h.action]}</span>
            <span className="text-muted-foreground">· {h.actorName}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{when(h.at)}</span>
          </div>
          {h.note ? <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{h.note}</p> : null}
          {h.changes.length ? (
            <ul className="mt-1 space-y-0.5 text-xs">
              {h.changes.map((c, i) => (
                <li key={i}>
                  <span className="font-medium">{FIELD_LABELS[c.field] ?? c.field}:</span>{" "}
                  <span className="text-muted-foreground line-through">{c.from || "(trống)"}</span>{" "}
                  → <span>{c.to || "(trống)"}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function TaskDetailView({ id }: { id: string }) {
  const { mutate: mutateAll } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR(taskKeys.detail(id), () => fetchTask(id));

  const [dialog, setDialog] = useState<"edit" | "approve" | "return" | "cancel" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => {
    void mutate();
    void mutateAll(
      (key) => Array.isArray(key) && key[0] === "tasks" && key[1] !== "detail",
    );
  };

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {getApiErrorMessage(error, "Không tải được nhiệm vụ.")}
          </CardContent>
        </Card>
      </div>
    );
  }
  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const { task, history, can } = data;
  const self = task.source === "SELF_REPORTED";
  const final = task.review?.stage === "HEAD";

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await submitTask(task._id);
      toast.success(res.message);
      refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không gửi được."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">
              {task.code ?? "(nháp - chưa có mã)"}
            </span>
            <StatusBadge status={task.status} />
            {isOverdue(task) ? <OverdueTag /> : null}
            <span className="text-xs text-muted-foreground">
              {self ? "Tự khai" : "Được giao"}
            </span>
          </div>
          <h1 className="font-display text-xl font-semibold leading-snug tracking-tight md:text-2xl">
            {task.content || <span className="italic text-muted-foreground">(chưa có nội dung)</span>}
          </h1>
          {task.review ? (
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{reviewStepText(task)}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {can.review ? (
            <>
              <Button variant="outline" className="bg-background" onClick={() => setDialog("return")}>
                <Undo2 className="size-4" />
                Trả lại
              </Button>
              <Button onClick={() => setDialog("approve")}>
                <CheckCircle2 className="size-4" />
                {final ? "Chốt" : "Duyệt"}
              </Button>
            </>
          ) : null}
          {can.edit ? (
            <Button variant="outline" className="bg-background" onClick={() => setDialog("edit")}>
              <Pencil className="size-4" />
              Sửa
            </Button>
          ) : null}
          {can.submit ? (
            <Button onClick={() => void submit()} disabled={submitting}>
              <Send className="size-4" />
              {task.status === "RETURNED" ? "Gửi lại" : "Gửi duyệt"}
            </Button>
          ) : null}
          {can.cancel ? (
            <Button
              variant="outline"
              className="border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/50 dark:bg-destructive/10 dark:hover:bg-destructive/20"
              onClick={() => setDialog("cancel")}
            >
              <Ban className="size-4" />
              {self && task.status !== "IN_PROGRESS" ? "Rút lại" : "Huỷ"}
            </Button>
          ) : null}
        </div>
      </div>

      {task.status === "RETURNED" && task.lastReturn ? (
        <Notice tone="rose" title="Bị trả lại">
          {task.lastReturn.reason}
          <span className="ml-1 text-xs opacity-75">({when(task.lastReturn.at)})</span>
        </Notice>
      ) : null}
      {task.status === "PENDING_REVIEW" && task.lastReturn ? (
        <Notice tone="rose" title="Lần trả lại gần nhất">
          {task.lastReturn.reason}
        </Notice>
      ) : null}
      {task.status === "CANCELLED" && task.cancellation ? (
        <Notice tone="slate" title="Đã huỷ">
          {task.cancellation.reason}
          <span className="ml-1 text-xs opacity-75">({when(task.cancellation.at)})</span>
        </Notice>
      ) : null}
      {task.proposal && task.status === "PENDING_REVIEW" ? (
        <Notice tone="emerald" title="Đề xuất của Phó ban (bước 1)">
          {[
            task.proposal.type ? TYPE_LABELS[task.proposal.type] : "",
            task.proposal.priority ? `ưu tiên ${PRIORITY_LABELS[task.proposal.priority].toLowerCase()}` : "",
            task.proposal.evaluation ? EVALUATION_LABELS[task.proposal.evaluation] : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <TaskInfoCard task={task} />

          {task.reportedDone || task.result || task.status === "COMPLETED" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Kết quả</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="whitespace-pre-line text-sm">{task.result || "-"}</p>
                {task.status === "COMPLETED" ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Đánh giá">
                      <span className="font-medium">
                        {task.evaluation ? EVALUATION_LABELS[task.evaluation] : "-"}
                      </span>
                    </Field>
                    <Field label="Người xác nhận">{personName(task.confirmedById)}</Field>
                    <Field label="Ngày hoàn thành">{when(task.completedAt)}</Field>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tài liệu đính kèm</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentList items={task.attachments} />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Lịch sử xử lý</CardTitle>
          </CardHeader>
          <CardContent>
            <HistoryTimeline items={history} />
          </CardContent>
        </Card>
      </div>

      {self ? (
        <SelfReportDialog
          open={dialog === "edit"}
          onOpenChange={(o) => setDialog(o ? "edit" : null)}
          edit={task}
          onSaved={refresh}
        />
      ) : (
        <AssignTaskDialog
          open={dialog === "edit"}
          onOpenChange={(o) => setDialog(o ? "edit" : null)}
          edit={task}
          onSaved={refresh}
        />
      )}
      <ApproveDialog task={task} open={dialog === "approve"} onOpenChange={(o) => setDialog(o ? "approve" : null)} onDone={refresh} />
      <ReturnDialog
        task={task}
        targets={can.returnTargets}
        open={dialog === "return"}
        onOpenChange={(o) => setDialog(o ? "return" : null)}
        onDone={refresh}
      />
      <CancelDialog task={task} open={dialog === "cancel"} onOpenChange={(o) => setDialog(o ? "cancel" : null)} onDone={refresh} />
    </div>
  );
}

function BackLink() {
  return (
    <Button asChild variant="outline" size="sm" className="bg-background">
      <Link href="/tasks">
        <ArrowLeft className="size-4" />
        Danh sách nhiệm vụ
      </Link>
    </Button>
  );
}

const NOTICE_TONE = {
  rose: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
  slate: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
};

function Notice({
  tone,
  title,
  children,
}: {
  tone: keyof typeof NOTICE_TONE;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-md border px-4 py-3 text-sm", NOTICE_TONE[tone])}>
      <span className="font-semibold">{title}:</span> {children}
    </div>
  );
}
