import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Flag,
  FileText,
  Layers,
  UserCheck,
  UserCog,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  PRIORITY_LABELS,
  personName,
  type Task,
  type TaskPerson,
  type TaskPriority,
} from "@/features/tasks/api";
import { TypeBadge } from "@/features/tasks/components/task-badges";
import {
  daysBetweenYmd,
  formatYmd,
  serverDayjs,
  serverYmd,
} from "@/lib/server-time";
import { cn } from "@/lib/utils";

/* Mỗi nhóm một tông, biểu tượng nền nhạt - màu chỉ để dẫn mắt, chữ vẫn nói đủ. */
const TONE = {
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
type Tone = keyof typeof TONE;

function InfoItem({
  icon: Icon,
  label,
  tone,
  children,
  className,
}: {
  icon: LucideIcon;
  label: string;
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 gap-3", className)}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE[tone])}>
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 text-sm font-semibold text-foreground">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">{title}</h3>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function initials(p: TaskPerson) {
  const parts = (p.fullName?.trim() || p.username).split(/\s+/).filter(Boolean);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

/** Vòng chữ viết tắt + cấp bậc, họ tên - nhìn là nhận ra người. */
function PersonChip({ person }: { person?: TaskPerson | null }) {
  if (!person) return <span className="font-normal text-muted-foreground">-</span>;
  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
        {initials(person)}
      </span>
      <span className="truncate">{personName(person)}</span>
    </span>
  );
}

const PRIORITY_TONE: Record<TaskPriority, string> = {
  NORMAL: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  HIGH: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  VERY_HIGH: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
};

function PriorityBadge({ priority }: { priority: TaskPriority | null }) {
  if (!priority) return <span className="font-normal text-muted-foreground">Chưa xếp</span>;
  return (
    <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold", PRIORITY_TONE[priority])}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

/** Hạn hoàn thành + đếm ngày còn lại / quá hạn khi nhiệm vụ còn mở. */
function DueValue({ task }: { task: Task }) {
  if (!task.dueDate) return <span className="font-normal text-muted-foreground">-</span>;
  const open = ["IN_PROGRESS", "PENDING_CONFIRMATION", "PENDING_REVIEW", "RETURNED", "DRAFT"].includes(task.status);
  const left = open ? daysBetweenYmd(serverYmd(), task.dueDate) : null;
  let note: ReactNode = null;
  if (left !== null) {
    note =
      left < 0 ? (
        <span className="text-rose-600 dark:text-rose-400">quá hạn {-left} ngày</span>
      ) : left === 0 ? (
        <span className="text-orange-600 dark:text-orange-400">đến hạn hôm nay</span>
      ) : (
        <span className={left <= 2 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
          còn {left} ngày
        </span>
      );
  }
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span className="tabular-nums">{formatYmd(task.dueDate)}</span>
      {note ? <span className="text-xs font-medium">{note}</span> : null}
    </span>
  );
}

export function TaskInfoCard({ task }: { task: Task }) {
  const self = task.source === "SELF_REPORTED";
  const dueTone: Tone = (() => {
    if (!task.dueDate || ["COMPLETED", "CANCELLED"].includes(task.status)) return "slate";
    const left = daysBetweenYmd(serverYmd(), task.dueDate) ?? 99;
    return left < 0 ? "rose" : left <= 2 ? "amber" : "emerald";
  })();

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <Section title="Người thực hiện">
          <InfoItem icon={UserCheck} label="Chủ trì" tone="sky">
            <PersonChip person={task.ownerId} />
          </InfoItem>
          <InfoItem icon={Users} label="Phối hợp" tone="sky">
            {task.collaboratorIds.length ? (
              <span className="flex flex-col gap-1.5">
                {task.collaboratorIds.map((p) => (
                  <PersonChip key={p._id} person={p} />
                ))}
              </span>
            ) : (
              <span className="font-normal text-muted-foreground">Không có</span>
            )}
          </InfoItem>
          <InfoItem icon={UserCog} label={self ? "Người lập" : "Người giao"} tone="sky">
            <PersonChip person={self ? task.createdById : task.assignerId} />
          </InfoItem>
        </Section>

        <div className="border-t" />

        <Section title="Phân loại">
          <InfoItem icon={Layers} label="Loại nhiệm vụ" tone="violet">
            <TypeBadge type={task.type} />
          </InfoItem>
          <InfoItem icon={Flag} label="Mức độ ưu tiên" tone="violet">
            <PriorityBadge priority={task.priority} />
          </InfoItem>
          <InfoItem icon={FileText} label="Căn cứ" tone="violet">
            {task.basis ? (
              <span className="break-words">{task.basis}</span>
            ) : (
              <span className="font-normal text-muted-foreground">Không có</span>
            )}
          </InfoItem>
        </Section>

        <div className="border-t" />

        <Section title="Thời gian">
          <InfoItem icon={CalendarPlus} label={self ? "Ngày chốt" : "Ngày giao"} tone="amber">
            <span className="tabular-nums">
              {task.assignedAt ? serverDayjs(task.assignedAt).format("DD/MM/YYYY") : "-"}
            </span>
            {task.assignedAt ? (
              <span className="ml-1.5 text-xs font-normal tabular-nums text-muted-foreground">
                {serverDayjs(task.assignedAt).format("HH:mm")}
              </span>
            ) : null}
          </InfoItem>
          <InfoItem icon={CalendarClock} label="Ngày bắt đầu" tone="amber">
            <span className="tabular-nums">{task.startDate ? formatYmd(task.startDate) : "-"}</span>
          </InfoItem>
          <InfoItem icon={CalendarCheck} label="Hạn hoàn thành" tone={dueTone}>
            <DueValue task={task} />
          </InfoItem>
        </Section>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Tiến độ</span>
            <span className="font-display text-2xl font-bold tabular-nums">{task.progress}%</span>
          </div>
          <Progress value={task.progress} className="h-2.5" />
        </div>
      </CardContent>
    </Card>
  );
}
