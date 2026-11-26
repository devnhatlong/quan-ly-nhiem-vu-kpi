"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  CheckCheck,
  CheckCircle2,
  Flag,
  Forward,
  Pencil,
  Send,
  TrendingUp,
  Undo2,
  UserRoundX,
} from "lucide-react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchTask,
  markPartUndone,
  submitTask,
  taskKeys,
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
import { TaskStepper } from "@/features/tasks/components/task-stepper";
import { TaskTimeline } from "@/features/tasks/components/task-timeline";
import {
  ForwardDialog,
  PartDoneDialog,
  ProgressDialog,
  RecallDialog,
  ReportDialog,
} from "@/features/tasks/components/work-dialogs";
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


/**
 * Màn rộng (lg): khung dòng thời gian kéo tới đáy màn hình khi cột trái ngắn
 * hơn; cột trái dài hơn thì khung cao theo cột trái (lưới tự giãn). Gán thẳng
 * style qua ref - không setState trong effect.
 */
function useFillToViewportBottom(ready: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!ready || !el) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const fit = () => {
      if (!wide.matches) {
        el.style.minHeight = "";
        return;
      }
      // Vị trí so với đầu trang (không phụ thuộc đang cuộn tới đâu).
      let top = 0;
      for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) {
        top += n.offsetTop;
      }
      // 16px = lề dưới của vùng nội dung (main p-4).
      el.style.minHeight = `${Math.max(480, window.innerHeight - top - 16)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    wide.addEventListener("change", fit);
    return () => {
      window.removeEventListener("resize", fit);
      wide.removeEventListener("change", fit);
    };
  }, [ready]);
  return ref;
}

export function TaskDetailView({ id }: { id: string }) {
  const { mutate: mutateAll } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR(taskKeys.detail(id), () => fetchTask(id));

  const [dialog, setDialog] = useState<
    | "edit"
    | "approve"
    | "return"
    | "cancel"
    | "progress"
    | "report"
    | "forward"
    | "recall"
    | "partDone"
    | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const timelineBox = useFillToViewportBottom(Boolean(data));

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
  const completion = task.review?.kind === "COMPLETION";

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

  const undoPart = async () => {
    setSubmitting(true);
    try {
      const res = await markPartUndone(task._id);
      toast.success(res.message);
      refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không bỏ đánh dấu được."));
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
        </div>

        <div className="flex flex-wrap gap-2">
          {can.partDone ? (
            <Button
              variant="outline"
              className="border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
              onClick={() => setDialog("partDone")}
            >
              <CheckCheck className="size-4" />
              Xong phần việc của tôi
            </Button>
          ) : null}
          {can.partUndo ? (
            <Button
              variant="outline"
              className="bg-background"
              disabled={submitting}
              onClick={() => void undoPart()}
            >
              <Undo2 className="size-4" />
              Bỏ đánh dấu xong
            </Button>
          ) : null}
          {can.progress ? (
            <Button variant="outline" className="bg-background" onClick={() => setDialog("progress")}>
              <TrendingUp className="size-4" />
              Cập nhật tiến độ
            </Button>
          ) : null}
          {can.report ? (
            <Button onClick={() => setDialog("report")}>
              <Flag className="size-4" />
              Báo cáo hoàn thành
            </Button>
          ) : null}
          {can.forward ? (
            <Button variant="outline" className="bg-background" onClick={() => setDialog("forward")}>
              <Forward className="size-4" />
              Chuyển tiếp xử lý
            </Button>
          ) : null}
          {can.recall ? (
            <Button
              variant="outline"
              className="border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/50 dark:bg-destructive/10 dark:hover:bg-destructive/20"
              onClick={() => setDialog("recall")}
            >
              <UserRoundX className="size-4" />
              Thu hồi
            </Button>
          ) : null}
          {can.review ? (
            <>
              <Button
                variant="outline"
                className="border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/50 dark:bg-destructive/10 dark:hover:bg-destructive/20"
                onClick={() => setDialog("return")}
              >
                <Undo2 className="size-4" />
                Trả lại
              </Button>
              <Button onClick={() => setDialog("approve")}>
                <CheckCircle2 className="size-4" />
                {final ? "Chốt" : completion ? "Xác nhận" : "Duyệt"}
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

      {task.status === "CANCELLED" && task.cancellation ? (
        <Notice tone="slate" title="Đã huỷ">
          {task.cancellation.reason}
          <span className="ml-1 text-xs opacity-75">({when(task.cancellation.at)})</span>
        </Notice>
      ) : (
        <TaskStepper task={task} can={can} history={history} />
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_460px] 2xl:grid-cols-[1fr_520px]">
        <div className="min-w-0 space-y-4">
          <TaskInfoCard task={task} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tài liệu đính kèm</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentList items={task.attachments} />
            </CardContent>
          </Card>
        </div>

        {/* Màn rộng: khung cao đúng bằng cột thông tin bên trái (tối thiểu
            480px), dài quá thì cuộn bên trong danh sách; ô ý kiến luôn ở trên.
            Màn hẹp: xếp dưới, cao tối đa 70% màn hình. */}
        <div ref={timelineBox} className="relative min-w-0 lg:min-h-[480px]">
        <Card className="flex max-h-[70dvh] min-w-0 flex-col lg:absolute lg:inset-0 lg:max-h-none">
          <CardHeader>
            <CardTitle className="text-base">Dòng thời gian</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <TaskTimeline
              taskId={task._id}
              items={history}
              canComment={can.comment}
              onChanged={refresh}
            />
          </CardContent>
        </Card>
        </div>
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
      <ProgressDialog task={task} open={dialog === "progress"} onOpenChange={(o) => setDialog(o ? "progress" : null)} onDone={refresh} />
      <ReportDialog task={task} open={dialog === "report"} onOpenChange={(o) => setDialog(o ? "report" : null)} onDone={refresh} />
      <ForwardDialog task={task} open={dialog === "forward"} onOpenChange={(o) => setDialog(o ? "forward" : null)} onDone={refresh} />
      <PartDoneDialog task={task} open={dialog === "partDone"} onOpenChange={(o) => setDialog(o ? "partDone" : null)} onDone={refresh} />
      <RecallDialog task={task} open={dialog === "recall"} onOpenChange={(o) => setDialog(o ? "recall" : null)} onDone={refresh} />
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
