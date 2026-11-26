"use client";

import { useMemo, useState } from "react";
import { Crown, Loader2, UserCog, Users } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { MultiSelect } from "@/components/common/multi-select";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchSupervision,
  memberLabel,
  setDeputyAssistants,
  supervisionKeys,
  type SupervisionMember,
  type SupervisionOverview,
} from "@/features/supervision/api";
import { getApiErrorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((item) => set.has(item));
}

/** Khung đầu dòng của một người phụ trách: biểu tượng, chức danh, tên, số trợ lý. */
function OwnerHeader({
  icon: Icon,
  title,
  name,
  count,
  tone,
  saving,
}: {
  icon: typeof Users;
  title: string;
  name: string;
  count: number;
  tone: string;
  saving?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          tone,
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted-foreground">{title}</div>
        <div className="truncate text-sm font-semibold" title={name}>
          {name}
        </div>
      </div>
      {saving ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
      ) : null}
      <div className="shrink-0 text-right">
        <div className="text-2xl font-semibold leading-none tabular-nums">
          {count}
        </div>
        <div className="text-[11px] text-muted-foreground">trợ lý</div>
      </div>
    </div>
  );
}

export function SupervisionView() {
  const [departmentId, setDepartmentId] = useState("");
  /** Lựa chọn đang sửa dở của từng Phó ban - lưu khi đóng danh sách. */
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    supervisionKeys.overview(departmentId),
    () => fetchSupervision(departmentId || undefined),
    { revalidateOnFocus: false },
  );

  const deputies = useMemo(() => data?.deputies ?? [], [data]);
  const assistants = useMemo(() => data?.assistants ?? [], [data]);
  const heads = data?.heads ?? [];

  const assignedTo = (deputyId: string) =>
    assistants.filter((a) => a.supervisorId === deputyId).map((a) => a.id);
  const unassigned = assistants.filter((a) => !a.supervisorId);

  /* Mỗi dòng ghi đang thuộc ai - chọn trợ lý của Phó ban khác là chuyển sang. */
  const options = useMemo(() => {
    const deputyName = new Map(
      deputies.map((d) => [d.id, `Phó ban ${memberLabel(d)}`]),
    );
    return assistants.map((a) => ({
      value: a.id,
      label: memberLabel(a),
      hint: `${a.username} · ${
        a.supervisorId
          ? `đang thuộc ${deputyName.get(a.supervisorId)}`
          : "Trưởng ban trực tiếp"
      }`,
      keywords: `${a.username} ${a.fullName}`,
    }));
  }, [assistants, deputies]);

  const save = async (deputyId: string, next: string[]) => {
    setDrafts((prev) => {
      const rest = { ...prev };
      delete rest[deputyId];
      return rest;
    });
    if (sameSet(next, assignedTo(deputyId))) return;

    setSaving(deputyId);
    try {
      await mutate(
        async (prev?: SupervisionOverview) => {
          await setDeputyAssistants(deputyId, next);
          if (!prev) return prev;
          const picked = new Set(next);
          return {
            ...prev,
            assistants: prev.assistants.map((a) =>
              picked.has(a.id)
                ? { ...a, supervisorId: deputyId }
                : a.supervisorId === deputyId
                  ? { ...a, supervisorId: null }
                  : a,
            ),
          };
        },
        { revalidate: false, rollbackOnError: true },
      );
      toast.success("Đã lưu phân công.");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không lưu được phân công."));
    } finally {
      setSaving(null);
    }
  };

  const headNames = heads.map(memberLabel).join(", ") || "Chưa có Trưởng ban";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Phân công phụ trách
          </h1>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <span>Tổ chức</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Phân công phụ trách</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Chỉ quản trị hệ thống mới có nhiều Ban để chọn. */}
        {data && data.departments.length > 1 ? (
          <Select
            value={data.department?.id ?? ""}
            onValueChange={(value) => {
              setDrafts({});
              setDepartmentId(value);
            }}
          >
            <SelectTrigger className="w-72 bg-background">
              <SelectValue placeholder="Chọn đơn vị" />
            </SelectTrigger>
            <SelectContent>
              {data.departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {getApiErrorMessage(error, "Không tải được phân công.")}
          </CardContent>
        </Card>
      ) : isLoading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : !data?.department ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Bạn chưa phụ trách đơn vị nào.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {data.department.name}
            </span>{" "}
            - chọn các trợ lý cho từng Phó ban. Mỗi trợ lý chỉ thuộc một người
            phụ trách; trợ lý chưa giao cho Phó ban nào báo cáo trực tiếp
            Trưởng ban.
          </p>

          {!assistants.length ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
                <Users className="size-8 opacity-40" />
                Ban chưa có trợ lý nào đang hoạt động.
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-3">
            {deputies.map((deputy: SupervisionMember) => {
              const value = drafts[deputy.id] ?? assignedTo(deputy.id);
              return (
                <Card key={deputy.id} className="py-0">
                  <CardContent className="space-y-3 py-4">
                    <OwnerHeader
                      icon={UserCog}
                      title="Phó ban"
                      name={memberLabel(deputy)}
                      count={value.length}
                      tone="bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"
                      saving={saving === deputy.id}
                    />
                    <MultiSelect
                      value={value}
                      onValueChange={(next) =>
                        setDrafts((prev) => ({ ...prev, [deputy.id]: next }))
                      }
                      onClose={(next) => void save(deputy.id, next)}
                      options={options}
                      placeholder="Chọn trợ lý phụ trách..."
                      searchPlaceholder="Tìm theo tên hoặc tên đăng nhập..."
                      emptyText="Không có trợ lý phù hợp."
                      disabled={saving !== null || !assistants.length}
                    />
                  </CardContent>
                </Card>
              );
            })}

            {!deputies.length ? (
              <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
                Ban chưa có Phó ban nào - mọi trợ lý báo cáo trực tiếp Trưởng
                ban. Gán vai trò Phó ban ở Tổ chức › Người dùng.
              </p>
            ) : null}

            {/* Phần còn lại tự rơi về Trưởng ban - không chọn ở đây, chỉ xem. */}
            <Card className="py-0">
              <CardContent className="space-y-3 py-4">
                <OwnerHeader
                  icon={Crown}
                  title="Trưởng ban trực tiếp"
                  name={headNames}
                  count={unassigned.length}
                  tone="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                />
                {unassigned.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {unassigned.map((a) => (
                      <Badge
                        key={a.id}
                        variant="secondary"
                        className="font-normal"
                      >
                        {memberLabel(a)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Mọi trợ lý đều đã có Phó ban phụ trách.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
