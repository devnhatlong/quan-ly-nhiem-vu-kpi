"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  CircleDot,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/common/table-pagination";
import {
  deleteDepartment,
  departmentKeys,
  fetchDepartments,
  fetchUsers,
} from "@/features/organization/api";
import { ImportUnitsDialog } from "@/features/organization/components/import-units-dialog";
import { UnitFormDialog } from "@/features/organization/components/unit-form-dialog";
import type { Department } from "@/features/organization/types";
import { entityId } from "@/features/organization/types";
import {
  activeBadgeClass,
  inactiveBadgeClass,
  unitCodeBadgeClass,
} from "@/features/organization/badge-styles";
import { ROLE_LABELS } from "@/features/auth/types";
import { getApiErrorMessage } from "@/lib/api-client";
import { DEFAULT_PAGE_SIZE, rowIndex } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/** Bỏ dấu để tìm "tham muu" vẫn ra "Tham mưu". */
function fold(text: string) {
  return text
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function UnitsView() {
  const {
    data: departments = [],
    error: deptError,
    isLoading: deptLoading,
    mutate: mutateDepts,
  } = useSWR(departmentKeys.all, fetchDepartments, {
    revalidateOnFocus: false,
  });

  const { data: users = [], mutate: mutateUsers } = useSWR(
    departmentKeys.users,
    fetchUsers,
    { revalidateOnFocus: false },
  );

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formEdit, setFormEdit] = useState<Department | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLimit, setUsersLimit] = useState(DEFAULT_PAGE_SIZE);

  const memberCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const user of users) {
      const id = String(user.departmentId ?? "");
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [users]);

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return departments;
    return departments.filter(
      (d) => fold(d.name).includes(q) || fold(d.code).includes(q),
    );
  }, [departments, query]);

  const effectiveSelectedId = useMemo(() => {
    if (selectedId && departments.some((d) => entityId(d) === selectedId)) {
      return selectedId;
    }
    return departments[0] ? entityId(departments[0]) : "";
  }, [selectedId, departments]);

  const selected = departments.find((d) => entityId(d) === effectiveSelectedId);
  const unitUsers = users.filter(
    (u) => String(u.departmentId ?? "") === effectiveSelectedId,
  );
  const usersTotalPages = Math.max(1, Math.ceil(unitUsers.length / usersLimit));
  const pagedUsers = unitUsers.slice(
    (usersPage - 1) * usersLimit,
    usersPage * usersLimit,
  );

  useEffect(() => {
    setUsersPage(1);
  }, [effectiveSelectedId]);

  useEffect(() => {
    if (usersPage > usersTotalPages) setUsersPage(usersTotalPages);
  }, [usersPage, usersTotalPages]);

  const openCreate = () => {
    setFormEdit(null);
    setFormOpen(true);
  };

  const openEdit = (dept: Department) => {
    setFormEdit(dept);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDepartment(entityId(deleteTarget));
      toast.success("Đã xoá đơn vị.");
      if (entityId(deleteTarget) === effectiveSelectedId) setSelectedId("");
      setDeleteTarget(null);
      await mutateDepts();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không xoá được đơn vị."));
    } finally {
      setDeleting(false);
    }
  };

  const refresh = () => {
    void mutateDepts();
    void mutateUsers();
  };

  const deleteMembers = deleteTarget
    ? (memberCount.get(entityId(deleteTarget)) ?? 0)
    : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Đơn vị
          </h1>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <span>Tổ chức</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Đơn vị</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload />
            Import Excel
          </Button>
          <Button onClick={openCreate}>
            <Plus />
            Thêm đơn vị
          </Button>
        </div>
      </div>

      {deptError ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            {getApiErrorMessage(
              deptError,
              "Không tải được danh sách đơn vị. Kiểm tra đăng nhập và API.",
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(260px,320px)_1fr] lg:grid-rows-[minmax(0,1fr)]">
        {/* Danh sách đơn vị - cuộn trong khung, không kéo cả trang */}
        <Card className="flex h-full min-h-0 max-h-full flex-col overflow-hidden border-border/80 py-0 shadow-sm">
          <div className="border-b bg-muted/30 p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo mã hoặc tên..."
                className="pl-8"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {deptLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Đang tải...</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {departments.length ? "Không có đơn vị phù hợp." : "Chưa có đơn vị."}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {filtered.map((dept) => {
                  const id = entityId(dept);
                  const active = id === effectiveSelectedId;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(id)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                          active
                            ? "bg-primary/10 text-foreground dark:bg-primary/25"
                            : "hover:bg-muted",
                          !dept.isActive && "text-muted-foreground",
                        )}
                      >
                        <Badge
                          className={cn(
                            "min-w-[2.75rem] shrink-0 justify-center rounded px-1.5 py-0 text-[10px] font-bold tracking-wide",
                            unitCodeBadgeClass,
                          )}
                        >
                          {dept.code}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate">
                          {dept.name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {memberCount.get(id) ?? 0}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* Chi tiết */}
        <Card className="flex h-full min-h-0 max-h-full flex-col overflow-hidden border-border/80 py-0 shadow-sm">
          <CardContent className="min-h-0 flex-1 overflow-auto p-4">
            {!selected ? (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
                <Building2 className="h-10 w-10 opacity-40" />
                <p className="text-sm">
                  {departments.length
                    ? "Chọn một đơn vị để xem chi tiết"
                    : 'Chưa có đơn vị. Bấm "Thêm đơn vị" để tạo.'}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <h2 className="font-display text-xl font-semibold tracking-tight md:text-2xl">
                      {selected.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Mã:{" "}
                      <span className="font-medium text-foreground">
                        {selected.code}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(selected)}
                    >
                      <Pencil />
                      Sửa
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(selected)}
                    >
                      <Trash2 />
                      Xoá
                    </Button>
                  </div>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-3">
                  <StatBox
                    icon={<Users className="h-4 w-4" />}
                    label="Tài khoản"
                    value={String(unitUsers.length)}
                    className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                  />
                  <StatBox
                    icon={<CircleDot className="h-4 w-4" />}
                    label="Trạng thái"
                    value={selected.isActive ? "Hoạt động" : "Ngưng"}
                    className="bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
                  />
                </div>

                <h3 className="mb-2 text-sm font-semibold">
                  Tài khoản trong đơn vị
                </h3>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">STT</TableHead>
                        <TableHead>Họ tên</TableHead>
                        <TableHead>Tên đăng nhập</TableHead>
                        <TableHead>Chức vụ</TableHead>
                        <TableHead>Vai trò</TableHead>
                        <TableHead className="w-28">Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unitUsers.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="h-24 text-center text-muted-foreground"
                          >
                            Chưa có tài khoản thuộc đơn vị này.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pagedUsers.map((user, i) => (
                          <TableRow key={user.id}>
                            <TableCell className="text-muted-foreground">
                              {rowIndex(usersPage, usersLimit, i)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {user.rank ? `${user.rank} ` : ""}
                              {user.fullName || "-"}
                            </TableCell>
                            <TableCell>{user.username}</TableCell>
                            <TableCell>{user.position || "-"}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(user.roleAssignments ?? []).length === 0 ? (
                                  <span className="text-muted-foreground">
                                    -
                                  </span>
                                ) : (
                                  user.roleAssignments.map((r) => (
                                    <Badge
                                      key={`${user.id}-${r.roleCode}`}
                                      variant="outline"
                                    >
                                      {ROLE_LABELS[r.roleCode] ?? r.roleCode}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {user.isActive ? (
                                <Badge
                                  variant="outline"
                                  className={activeBadgeClass}
                                >
                                  Hoạt động
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={inactiveBadgeClass}
                                >
                                  Ngưng
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {unitUsers.length > 0 ? (
                  <TablePagination
                    page={usersPage}
                    limit={usersLimit}
                    total={unitUsers.length}
                    totalPages={usersTotalPages}
                    onPageChange={setUsersPage}
                    onLimitChange={(next) => {
                      setUsersLimit(next);
                      setUsersPage(1);
                    }}
                  />
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <UnitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        edit={formEdit}
        onSuccess={refresh}
      />

      <ImportUnitsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={refresh}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá đơn vị?</AlertDialogTitle>
            <AlertDialogDescription>
              Xoá &quot;{deleteTarget?.name}&quot; ({deleteTarget?.code}).{" "}
              {deleteMembers
                ? `Đơn vị còn ${deleteMembers} tài khoản - chuyển hoặc xoá các tài khoản đó trước thì mới xoá được.`
                : "Chỉ xoá được khi đơn vị không còn tài khoản."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting || deleteMembers > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Đang xoá..." : "Xoá"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border border-black/5 px-4 py-3 dark:border-white/10",
        className,
      )}
    >
      {icon}
      <div>
        <div className="text-xs font-medium opacity-80">{label}</div>
        <div className="font-display text-lg font-bold leading-tight">
          {value}
        </div>
      </div>
    </div>
  );
}
