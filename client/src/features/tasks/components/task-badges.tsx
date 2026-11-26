import { Badge } from "@/components/ui/badge";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
} from "@/features/tasks/api";
import { serverYmd } from "@/lib/server-time";
import { cn } from "@/lib/utils";

/* Màu luôn đi kèm chữ - không bao giờ là kênh thông tin duy nhất. */
const STATUS_TONE: Record<TaskStatus, string> = {
  DRAFT: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  PENDING_REVIEW: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  RETURNED: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  IN_PROGRESS: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  PENDING_CONFIRMATION: "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  COMPLETED: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  CANCELLED: "border-slate-300 bg-slate-100 text-slate-500 line-through dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_TONE[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const TYPE_TONE: Record<TaskType, string> = {
  REGULAR: "text-muted-foreground",
  UNEXPECTED: "border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-300",
  KEY: "border-violet-300 text-violet-700 dark:border-violet-800 dark:text-violet-300",
};

export function TypeBadge({ type }: { type: TaskType | null }) {
  if (!type) return <span className="text-xs text-muted-foreground">Chưa xếp loại</span>;
  return (
    <Badge variant="outline" className={cn("font-normal", TYPE_TONE[type])}>
      {TYPE_LABELS[type]}
    </Badge>
  );
}

export function PriorityText({ priority }: { priority: TaskPriority | null }) {
  if (!priority) return <span className="text-muted-foreground">-</span>;
  return (
    <span
      className={cn(
        priority === "VERY_HIGH" && "font-semibold text-rose-600 dark:text-rose-400",
        priority === "HIGH" && "font-medium text-amber-700 dark:text-amber-400",
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

/** Quá hạn: đang mở mà đã qua hạn (theo ngày giờ server). */
export function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  if (!["IN_PROGRESS", "PENDING_CONFIRMATION"].includes(task.status)) return false;
  return task.dueDate < serverYmd();
}

export function OverdueTag() {
  return (
    <span className="rounded-sm border border-rose-300 bg-rose-50 px-1 text-[10px] font-semibold uppercase leading-4 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
      Quá hạn
    </span>
  );
}
