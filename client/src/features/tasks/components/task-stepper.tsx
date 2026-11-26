import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  EVALUATION_LABELS,
  PRIORITY_LABELS,
  TYPE_LABELS,
  handlerOf,
  isForwarded,
  personName,
  type Task,
  type TaskCapabilities,
  type TaskHistoryEntry,
} from "@/features/tasks/api";
import { serverDayjs } from "@/lib/server-time";
import { cn } from "@/lib/utils";

type StepState = "done" | "current" | "todo";

type Step = {
  key: string;
  title: string;
  who?: string;
  state: StepState;
  /** Nhãn nổi bật khi bước hiện tại đang chờ chính người xem. */
  mine?: string;
  lines?: ReactNode[];
  /** Lý do trả lại gần nhất - chỉ hiện ở bước đang phải làm lại. */
  returned?: string;
};

function day(value?: string | null) {
  return value ? serverDayjs(value).format("DD/MM/YYYY") : "";
}

/** Phó ban đã xác nhận bước 1 cho lần báo cáo hoàn thành gần nhất (nếu có). */
function deputyConfirmer(history: TaskHistoryEntry[]) {
  const lastReport = history.map((h) => h.action).lastIndexOf("REPORTED");
  if (lastReport < 0) return null;
  return (
    history.slice(lastReport).find((h) => h.action === "APPROVED_STEP") ?? null
  );
}

/** Bị trả lại về đúng bước đang làm (chưa gửi lại sau lần trả đó). */
function activeReturn(task: Task): string | undefined {
  const r = task.lastReturn;
  if (!r) return undefined;
  const at = serverDayjs(r.at).valueOf();
  if (task.status === "RETURNED") return r.reason;
  if (task.status === "IN_PROGRESS" && task.reportedAt) {
    return at >= serverDayjs(task.reportedAt).valueOf() ? r.reason : undefined;
  }
  if (task.review && at >= serverDayjs(task.review.since).valueOf() - 2000)
    return r.reason;
  return undefined;
}

function submissionSteps(task: Task, can: TaskCapabilities): Step[] {
  const stage = task.status === "PENDING_REVIEW" ? task.review?.stage : null;
  const deputy = task.review?.deputyId;
  const first: StepState = stage ? "done" : "current";
  const steps: Step[] = [
    {
      key: "draft",
      title: task.status === "RETURNED" ? "Sửa, gửi lại" : "Lập bản tự khai",
      who: personName(task.createdById),
      state: first,
      mine:
        first === "current" && (can.edit || can.submit)
          ? "Chờ bạn gửi"
          : undefined,
      returned: task.status === "RETURNED" ? activeReturn(task) : undefined,
    },
  ];
  if (deputy) {
    steps.push({
      key: "deputy",
      title: "Phó ban duyệt",
      who: personName(deputy),
      state:
        stage === "DEPUTY" ? "current" : stage === "HEAD" ? "done" : "todo",
      mine: stage === "DEPUTY" && can.review ? "Chờ bạn duyệt" : undefined,
      returned: stage === "DEPUTY" ? activeReturn(task) : undefined,
      lines:
        stage === "HEAD" && task.proposal
          ? [
              `Đề xuất: ${[
                task.proposal.type ? TYPE_LABELS[task.proposal.type] : "",
                task.proposal.priority
                  ? `ưu tiên ${PRIORITY_LABELS[task.proposal.priority].toLowerCase()}`
                  : "",
                task.proposal.evaluation
                  ? EVALUATION_LABELS[task.proposal.evaluation]
                  : "",
              ]
                .filter(Boolean)
                .join(", ")}`,
            ]
          : undefined,
    });
  }
  steps.push({
    key: "head",
    title: "Trưởng ban chốt",
    state: stage === "HEAD" ? "current" : "todo",
    mine: stage === "HEAD" && can.review ? "Chờ bạn chốt" : undefined,
  });
  return steps;
}

function completionSteps(
  task: Task,
  can: TaskCapabilities,
  history: TaskHistoryEntry[],
): Step[] {
  const pending = task.status === "PENDING_CONFIRMATION";
  const done = task.status === "COMPLETED";
  const stage = pending ? task.review?.stage : null;
  const self = task.source === "SELF_REPORTED";

  const steps: Step[] = [
    {
      key: "assign",
      title: self ? "Tự khai được duyệt" : "Giao việc",
      who: personName(self ? task.approvedById : task.assignerId),
      state: "done",
      lines: task.assignedAt ? [day(task.assignedAt)] : undefined,
    },
    {
      key: "work",
      title: "Thực hiện",
      who: personName(handlerOf(task)),
      state: task.status === "IN_PROGRESS" ? "current" : "done",
      mine:
        task.status === "IN_PROGRESS" && can.report
          ? "Bạn đang xử lý"
          : task.status === "IN_PROGRESS" && can.partDone
            ? "Bạn đang phối hợp"
            : undefined,
      returned: task.status === "IN_PROGRESS" ? activeReturn(task) : undefined,
      lines: [
        isForwarded(task) ? `Chuyển tiếp từ ${personName(task.ownerId)}` : null,
        `Tiến độ ${task.progress}%`,
      ].filter(Boolean) as string[],
    },
  ];

  // Bước Phó ban: đang chờ → lấy từ review; đã qua → từ lịch sử; chưa báo
  // cáo mà đã chuyển tiếp → Phó ban chuyển tiếp sẽ xác nhận.
  const confirmed = done || stage === "HEAD" ? deputyConfirmer(history) : null;
  const deputyName = pending
    ? task.review?.deputyId
      ? personName(task.review.deputyId)
      : null
    : confirmed
      ? confirmed.actorName
      : task.status === "IN_PROGRESS" && isForwarded(task)
        ? personName(task.forwardedById)
        : null;
  if (deputyName) {
    steps.push({
      key: "deputy",
      title: "Phó ban xác nhận",
      who: deputyName,
      state:
        stage === "DEPUTY"
          ? "current"
          : stage === "HEAD" || done
            ? "done"
            : "todo",
      mine: stage === "DEPUTY" && can.review ? "Chờ bạn xác nhận" : undefined,
      returned: stage === "DEPUTY" ? activeReturn(task) : undefined,
      lines:
        (stage === "HEAD" || done) && task.proposal?.evaluation
          ? [`Đề xuất: ${EVALUATION_LABELS[task.proposal.evaluation]}`]
          : undefined,
    });
  }
  steps.push({
    key: "head",
    title: "Trưởng ban chốt",
    who: done ? personName(task.confirmedById) : undefined,
    state: done ? "done" : stage === "HEAD" ? "current" : "todo",
    mine: stage === "HEAD" && can.review ? "Chờ bạn chốt" : undefined,
    lines: done
      ? ([
          task.evaluation ? EVALUATION_LABELS[task.evaluation] : null,
          day(task.completedAt),
        ].filter(Boolean) as string[])
      : undefined,
  });
  return steps;
}

/**
 * Tiến trình xử lý: các bước từ giao đến chốt, bước nào đang chờ ai. Chỉ tóm
 * tắt trạng thái hiện tại - chi tiết từng lần thao tác ở dòng thời gian.
 */
export function TaskStepper({
  task,
  can,
  history,
}: {
  task: Task;
  can: TaskCapabilities;
  history: TaskHistoryEntry[];
}) {
  if (task.status === "CANCELLED") return null;
  const submission = ["DRAFT", "PENDING_REVIEW", "RETURNED"].includes(
    task.status,
  );
  const steps = submission
    ? submissionSteps(task, can)
    : completionSteps(task, can, history);

  /** Đoạn nối giữa bước i và bước i+1: xanh khi đã qua bước i. */
  const link = (i: number) =>
    steps[i]?.state === "done" ? "bg-emerald-500" : "bg-border";

  return (
    <Card className="py-0">
      <CardContent className="px-4 py-4 md:px-2">
        {/* Màn rộng: các bước nằm ngang, vòng tròn nối bằng đường kẻ, chữ căn
            giữa dưới vòng và tự xuống dòng. Màn hẹp: xếp dọc như dòng thời gian. */}
        <ol className="flex flex-col md:flex-row">
          {steps.map((s, i) => {
            const last = i === steps.length - 1;
            return (
              <li
                key={s.key}
                className="flex min-w-0 gap-3 md:flex-1 md:flex-col md:gap-0"
              >
                {/* Trục: dọc ở màn hẹp, ngang ở màn rộng */}
                <div className="flex flex-col items-center md:flex-row">
                  <span
                    className={cn(
                      "hidden h-0.5 flex-1 md:block",
                      i === 0 ? "invisible" : link(i - 1),
                    )}
                  />
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      s.state === "done" && "bg-emerald-600 text-white",
                      s.state === "current" &&
                        "bg-primary text-primary-foreground ring-4 ring-primary/25",
                      s.state === "todo" &&
                        "border-2 border-dashed border-muted-foreground/40 bg-card text-muted-foreground",
                    )}
                  >
                    {s.state === "done" ? <Check className="size-4" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "min-h-4 w-0.5 flex-1 md:h-0.5 md:min-h-0 md:w-auto",
                      last ? "invisible" : link(i),
                    )}
                  />
                </div>

                <div
                  className={cn(
                    "min-w-0 flex-1 pb-5 md:mt-2.5 md:px-3 md:pb-0 md:text-center",
                    last && "pb-0",
                  )}
                >
                  <div
                    className={cn(
                      "text-sm font-semibold leading-snug",
                      s.state === "todo" && "text-muted-foreground",
                      s.state === "current" && "text-primary",
                    )}
                  >
                    {s.title}
                  </div>
                  {s.mine ? (
                    <span className="mt-1 inline-block rounded-md bg-amber-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                      {s.mine}
                    </span>
                  ) : null}
                  <div className="mt-1 space-y-0.5 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere] md:[text-wrap:balance]">
                    {s.who ? (
                      <div className="font-medium text-foreground/85">
                        {s.who}
                      </div>
                    ) : null}
                    {s.lines?.map((l, k) => (
                      <div key={k}>{l}</div>
                    ))}
                  </div>
                  {s.returned ? (
                    <div className="mt-1.5 rounded-md bg-rose-100 px-2 py-1 text-left text-xs text-rose-800 [overflow-wrap:anywhere] dark:bg-rose-950/60 dark:text-rose-200">
                      <span className="font-semibold">Bị trả lại:</span>{" "}
                      {s.returned}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
