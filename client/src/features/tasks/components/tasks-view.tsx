"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, FilePlus2, Plus, Search } from "lucide-react";
import useSWR, { useSWRConfig } from "swr";

import { SegmentedTabs } from "@/components/common/segmented-tabs";
import { TablePagination } from "@/components/common/table-pagination";
import { CountBadge } from "@/components/common/count-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERM } from "@/constants/permissions";
import { useAuth } from "@/features/auth/auth-provider";
import { userHasAnyPermission, userHasAnyRole } from "@/features/auth/types";
import {
  STATUS_LABELS,
  fetchTaskCounts,
  fetchTasks,
  handlerOf,
  isForwarded,
  personName,
  reviewStepText,
  taskKeys,
  type TaskStatus,
  type TaskView,
} from "@/features/tasks/api";
import { AssignTaskDialog } from "@/features/tasks/components/assign-task-dialog";
import { SelfReportDialog } from "@/features/tasks/components/self-report-dialog";
import {
  OverdueTag,
  StatusBadge,
  TypeBadge,
  isOverdue,
} from "@/features/tasks/components/task-badges";
import { useListPagination } from "@/hooks/use-list-pagination";
import { getApiErrorMessage } from "@/lib/api-client";
import { emptyPaginationMeta, rowIndex } from "@/lib/pagination";
import { formatYmd } from "@/lib/server-time";

const ALL_STATUSES = "__all__";
const VIEWS: TaskView[] = ["mine", "assigned", "review", "all"];

export function TasksView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { mutate: mutateAll } = useSWRConfig();

  const canAssign = userHasAnyPermission(user, [PERM.TASK_ASSIGN]);
  const canSelfReport = userHasAnyPermission(user, [PERM.TASK_SELF_REPORT]);
  const canReview = userHasAnyPermission(user, [PERM.TASK_REVIEW]);
  const isHead = userHasAnyRole(user, ["HEAD"]);

  const tabs: Array<{ value: TaskView; label: string }> = [
    { value: "mine", label: "Của tôi" },
    ...(canAssign ? [{ value: "assigned" as const, label: "Tôi giao" }] : []),
    ...(canReview ? [{ value: "review" as const, label: "Chờ tôi duyệt" }] : []),
    ...(canReview
      ? [{ value: "all" as const, label: isHead ? "Toàn Ban" : "Phạm vi phụ trách" }]
      : []),
  ];

  const requested = searchParams.get("view") as TaskView | null;
  const view: TaskView =
    requested && VIEWS.includes(requested) && tabs.some((t) => t.value === requested)
      ? requested
      : "mine";
  const [status, setStatus] = useState<TaskStatus | "">("");
  const { page, setPage, limit, setLimit, query, setQuery, debouncedQuery } =
    useListPagination(20);

  const params = { view, status, q: debouncedQuery, page, limit };
  const { data, error, isLoading } = useSWR(taskKeys.list(params), () => fetchTasks(params), {
    keepPreviousData: true,
  });
  const { data: counts } = useSWR(taskKeys.counts, fetchTaskCounts);

  const [assignOpen, setAssignOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const rows = data?.data ?? [];
  const meta = data?.meta ?? emptyPaginationMeta(limit);

  const setView = (next: TaskView) => {
    setPage(1);
    router.replace(`/tasks?view=${next}`, { scroll: false });
  };

  const afterSave = (id: string) => {
    void mutateAll((key) => Array.isArray(key) && key[0] === "tasks");
    if (id) router.push(`/tasks/${id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Giao nhiệm vụ</h1>
          <p className="text-sm text-muted-foreground">
            Giao việc, tự khai việc phát sinh, theo dõi và duyệt nhiệm vụ.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSelfReport ? (
            <Button variant="outline" className="bg-background" onClick={() => setReportOpen(true)}>
              <FilePlus2 className="size-4" />
              Tự khai nhiệm vụ
            </Button>
          ) : null}
          {canAssign ? (
            <Button onClick={() => setAssignOpen(true)}>
              <Plus className="size-4" />
              Giao nhiệm vụ
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          ariaLabel="Nhóm nhiệm vụ"
          value={view}
          onChange={setView}
          items={tabs.map((t) => ({
            value: t.value,
            label: (
              <span className="inline-flex items-center gap-1.5">
                {t.label}
                <CountBadge
                  count={counts?.[t.value]}
                  className="ml-0"
                  label={`${counts?.[t.value] ?? 0} nhiệm vụ`}
                />
              </span>
            ),
          }))}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="bg-background pl-8"
              placeholder="Tìm theo mã, nội dung, căn cứ..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select
            value={status || ALL_STATUSES}
            onValueChange={(v) => {
              setStatus(v === ALL_STATUSES ? "" : (v as TaskStatus));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>Mọi trạng thái</SelectItem>
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          {error ? (
            <p className="py-10 text-center text-sm text-destructive">
              {getApiErrorMessage(error, "Không tải được nhiệm vụ.")}
            </p>
          ) : isLoading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 pl-4">STT</TableHead>
                  <TableHead className="w-36">Mã</TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead className="w-52">Chủ trì</TableHead>
                  <TableHead className="w-28">Hạn</TableHead>
                  <TableHead className="w-20 text-right">Tiến độ</TableHead>
                  <TableHead className="w-52 pr-4">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!rows.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-36 text-center text-muted-foreground">
                      <div className="inline-flex flex-col items-center gap-2">
                        <ClipboardList className="size-8 opacity-40" />
                        <span>
                          {view === "review" ? "Không có bản nào chờ bạn duyệt." : "Chưa có nhiệm vụ nào."}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((task, index) => (
                    <TableRow
                      key={task._id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/tasks/${task._id}`)}
                    >
                      <TableCell className="pl-4 align-top text-muted-foreground">
                        {rowIndex(meta.page, meta.limit, index)}
                      </TableCell>
                      <TableCell className="align-top font-mono text-xs">
                        {task.code ?? <span className="italic text-muted-foreground">(nháp)</span>}
                        {task.source === "SELF_REPORTED" ? (
                          <div className="mt-1 font-sans text-[11px] text-muted-foreground">Tự khai</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-0 align-top">
                        <div className="line-clamp-2 whitespace-normal font-medium">
                          {task.content || <span className="italic text-muted-foreground">(chưa có nội dung)</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <TypeBadge type={task.type} />
                          {task.basis ? (
                            <span className="truncate text-xs text-muted-foreground">{task.basis}</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="truncate text-sm">{personName(task.ownerId)}</div>
                        {isForwarded(task) ? (
                          <div className="truncate text-xs text-violet-700 dark:text-violet-300">
                            → {personName(handlerOf(task))} xử lý
                          </div>
                        ) : null}
                        {task.collaboratorIds.length ? (
                          <div className="text-xs text-muted-foreground">
                            +{task.collaboratorIds.length} phối hợp
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top text-sm tabular-nums">
                        {task.dueDate ? formatYmd(task.dueDate) : "-"}
                      </TableCell>
                      <TableCell className="align-top text-right text-sm tabular-nums">
                        {task.progress}%
                      </TableCell>
                      <TableCell className="pr-4 align-top">
                        <div className="flex flex-wrap items-center gap-1">
                          <StatusBadge status={task.status} />
                          {isOverdue(task) ? <OverdueTag /> : null}
                        </div>
                        {task.review ? (
                          <div className="mt-1 text-[11px] text-muted-foreground">{reviewStepText(task)}</div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {meta.total ? (
        <TablePagination
          page={meta.page}
          limit={meta.limit}
          total={meta.total}
          totalPages={meta.totalPages}
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
        />
      ) : null}

      <AssignTaskDialog open={assignOpen} onOpenChange={setAssignOpen} onSaved={afterSave} />
      <SelfReportDialog open={reportOpen} onOpenChange={setReportOpen} onSaved={afterSave} />
    </div>
  );
}
