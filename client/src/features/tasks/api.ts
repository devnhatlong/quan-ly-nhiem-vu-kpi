import type { ApiResponse, PaginatedResult } from "@/features/auth/types";
import type { Attachment } from "@/features/uploads/api";
import { api, unwrapData, unwrapPaginated } from "@/lib/api-client";

// ------------------------------------------------------------------ kiểu

export type TaskSource = "ASSIGNED" | "SELF_REPORTED";
export type TaskStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "RETURNED"
  | "IN_PROGRESS"
  | "PENDING_CONFIRMATION"
  | "COMPLETED"
  | "CANCELLED";
export type TaskType = "REGULAR" | "UNEXPECTED" | "KEY";
export type TaskPriority = "NORMAL" | "HIGH" | "VERY_HIGH";
export type TaskEvaluation = "EXCELLENT" | "GOOD" | "COMPLETED" | "NOT_COMPLETED";
export type TaskView = "mine" | "assigned" | "review" | "all";
export type ReturnTarget = "PREVIOUS" | "START";

export type TaskPerson = {
  _id: string;
  username: string;
  fullName?: string;
  rank?: string;
};

export type TaskAttachment = Attachment & { classification?: string | null };

export type Task = {
  _id: string;
  code?: string;
  source: TaskSource;
  content: string;
  basis: string;
  type: TaskType | null;
  priority: TaskPriority | null;
  createdById: TaskPerson;
  assignerId: TaskPerson | null;
  ownerId: TaskPerson;
  collaboratorIds: TaskPerson[];
  startDate: string | null;
  dueDate: string | null;
  assignedAt: string | null;
  progress: number;
  status: TaskStatus;
  reportedDone: boolean;
  result: string;
  attachments: TaskAttachment[];
  review: {
    kind: "SUBMISSION" | "COMPLETION";
    stage: "DEPUTY" | "HEAD";
    deputyId: TaskPerson | null;
    since: string;
  } | null;
  proposal: {
    type: TaskType | null;
    priority: TaskPriority | null;
    evaluation: TaskEvaluation | null;
    at: string;
  } | null;
  lastReturn: { at: string; reason: string } | null;
  approvedById: TaskPerson | null;
  completedAt: string | null;
  confirmedById: TaskPerson | null;
  evaluation: TaskEvaluation | null;
  cancellation: { at: string; reason: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskHistoryEntry = {
  _id: string;
  actorName: string;
  action:
    | "CREATED"
    | "UPDATED"
    | "SUBMITTED"
    | "APPROVED_STEP"
    | "APPROVED"
    | "RETURNED"
    | "CANCELLED";
  note: string;
  changes: Array<{ field: string; from: string; to: string }>;
  at: string;
};

/** Thao tác server cho phép người đang xem - giao diện chỉ hiện đúng các nút này. */
export type TaskCapabilities = {
  edit: boolean;
  submit: boolean;
  review: boolean;
  returnTargets: ReturnTarget[];
  cancel: boolean;
};

export type TaskDetail = {
  task: Task;
  history: TaskHistoryEntry[];
  can: TaskCapabilities;
};

export type TaskCounts = Record<TaskView, number>;

export type PickPerson = {
  id: string;
  username: string;
  name: string;
  role: "DEPUTY" | "ASSISTANT";
  /** Chức vụ ghi trên hồ sơ; trống thì hiện theo vai trò. */
  position: string;
};

/** Nhãn màu chức vụ cho ô chọn người: Phó ban xanh dương, trợ lý xanh lá. */
export function personTag(p: PickPerson) {
  return {
    label: p.position || (p.role === "DEPUTY" ? "Phó ban" : "Trợ lý"),
    className:
      p.role === "DEPUTY"
        ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  };
}

export type AssignTaskInput = {
  content: string;
  basis?: string;
  type: TaskType;
  priority: TaskPriority;
  ownerId: string;
  collaboratorIds?: string[];
  startDate?: string;
  dueDate: string;
  attachmentIds?: string[];
};

export type SelfReportInput = {
  content?: string;
  basis?: string;
  collaboratorIds?: string[];
  startDate?: string;
  dueDate?: string;
  reportedDone?: boolean;
  result?: string;
  attachmentIds?: string[];
  submit?: boolean;
};

export type ApproveInput = {
  type?: TaskType;
  priority?: TaskPriority;
  evaluation?: TaskEvaluation;
  note?: string;
};

// ------------------------------------------------------------------ nhãn

export const STATUS_LABELS: Record<TaskStatus, string> = {
  DRAFT: "Nháp",
  PENDING_REVIEW: "Chờ duyệt",
  RETURNED: "Bị trả lại",
  IN_PROGRESS: "Đang thực hiện",
  PENDING_CONFIRMATION: "Chờ xác nhận",
  COMPLETED: "Đã hoàn thành",
  CANCELLED: "Đã huỷ",
};

export const TYPE_LABELS: Record<TaskType, string> = {
  REGULAR: "Thường xuyên",
  UNEXPECTED: "Đột xuất",
  KEY: "Trọng tâm",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  NORMAL: "Bình thường",
  HIGH: "Cao",
  VERY_HIGH: "Rất cao",
};

export const EVALUATION_LABELS: Record<TaskEvaluation, string> = {
  EXCELLENT: "Hoàn thành xuất sắc",
  GOOD: "Hoàn thành tốt",
  COMPLETED: "Hoàn thành",
  NOT_COMPLETED: "Không hoàn thành",
};

export const FIELD_LABELS: Record<string, string> = {
  content: "Nội dung",
  basis: "Căn cứ",
  type: "Loại",
  priority: "Mức độ ưu tiên",
  owner: "Chủ trì",
  collaborators: "Phối hợp",
  startDate: "Ngày bắt đầu",
  dueDate: "Hạn hoàn thành",
  reportedDone: "Tình trạng",
  result: "Kết quả",
  attachments: "Đính kèm",
  evaluation: "Đánh giá",
  status: "Trạng thái",
};

export const HISTORY_LABELS: Record<TaskHistoryEntry["action"], string> = {
  CREATED: "Tạo",
  UPDATED: "Sửa",
  SUBMITTED: "Gửi duyệt",
  APPROVED_STEP: "Duyệt bước 1",
  APPROVED: "Chốt",
  RETURNED: "Trả lại",
  CANCELLED: "Huỷ",
};

/** "Đại úy Hoàng Thu Trang". */
export function personName(p?: TaskPerson | null): string {
  if (!p) return "";
  const name = p.fullName?.trim() || p.username;
  return p.rank ? `${p.rank} ${name}` : name;
}

/** Dòng phụ dưới trạng thái: đang chờ ai, bước mấy. */
export function reviewStepText(task: Task): string {
  if (!task.review) return "";
  const twoSteps = Boolean(task.review.deputyId);
  if (task.review.stage === "DEPUTY") {
    return `Bước 1/2: chờ Phó ban ${personName(task.review.deputyId)}`;
  }
  return twoSteps ? "Bước 2/2: chờ Trưởng ban chốt" : "Chờ Trưởng ban chốt";
}

// ------------------------------------------------------------------ API

export const taskKeys = {
  list: (params: Record<string, unknown>) => ["tasks", "list", params] as const,
  counts: ["tasks", "counts"] as const,
  detail: (id: string) => ["tasks", "detail", id] as const,
  people: (purpose: "assign" | "self-report") =>
    ["tasks", "people", purpose] as const,
};

export function fetchTasks(params: {
  view: TaskView;
  status?: TaskStatus | "";
  q?: string;
  page: number;
  limit: number;
}): Promise<PaginatedResult<Task>> {
  return unwrapPaginated(
    api.get<ApiResponse<Task[]>>("/tasks", {
      params: {
        view: params.view,
        page: params.page,
        limit: params.limit,
        ...(params.status ? { status: params.status } : {}),
        ...(params.q?.trim() ? { q: params.q.trim() } : {}),
      },
    }),
  );
}

export function fetchTaskCounts() {
  return unwrapData(api.get<ApiResponse<TaskCounts>>("/tasks/counts"));
}

export function fetchTask(id: string) {
  return unwrapData(api.get<ApiResponse<TaskDetail>>(`/tasks/${id}`));
}

export function fetchPickPeople(purpose: "assign" | "self-report") {
  return unwrapData(
    api.get<ApiResponse<PickPerson[]>>(`/tasks/people/${purpose}`),
  );
}

type Saved = { id: string; code?: string };

export function createAssignedTask(input: AssignTaskInput) {
  return api.post<ApiResponse<Saved>>("/tasks", input).then((r) => r.data);
}

export function updateAssignedTask(id: string, input: Partial<AssignTaskInput>) {
  return api.patch<ApiResponse<Saved>>(`/tasks/${id}`, input).then((r) => r.data);
}

export function createSelfReport(input: SelfReportInput) {
  return api
    .post<ApiResponse<Saved>>("/tasks/self-reports", input)
    .then((r) => r.data);
}

export function updateSelfReport(id: string, input: SelfReportInput) {
  return api
    .patch<ApiResponse<Saved>>(`/tasks/self-reports/${id}`, input)
    .then((r) => r.data);
}

export function submitTask(id: string) {
  return api.post<ApiResponse<Saved>>(`/tasks/${id}/submit`).then((r) => r.data);
}

export function approveTask(id: string, input: ApproveInput) {
  return api
    .post<ApiResponse<Saved>>(`/tasks/${id}/approve`, input)
    .then((r) => r.data);
}

export function returnTask(id: string, reason: string, to: ReturnTarget) {
  return api
    .post<ApiResponse<Saved>>(`/tasks/${id}/return`, { reason, to })
    .then((r) => r.data);
}

export function cancelTask(id: string, reason: string) {
  return api
    .post<ApiResponse<Saved>>(`/tasks/${id}/cancel`, { reason })
    .then((r) => r.data);
}
