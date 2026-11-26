/** Nguồn nhiệm vụ: giao từ trên xuống, hay người dưới tự khai gửi lên. */
export const TASK_SOURCES = ['ASSIGNED', 'SELF_REPORTED'] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

/**
 * Trạng thái (docs/xac-nhan-nghiep-vu.md - K2):
 * - DRAFT: bản tự khai chưa gửi, chỉ người lập thấy.
 * - PENDING_REVIEW: bản tự khai đang chờ duyệt (bước ở `review.stage`).
 * - RETURNED: bản tự khai bị trả về người lập.
 * - IN_PROGRESS: đang thực hiện.
 * - PENDING_CONFIRMATION: đã báo hoàn thành, chờ xác nhận (giai đoạn 2).
 * - COMPLETED: đã hoàn thành (đã chốt).
 * - CANCELLED: đã huỷ - không bao giờ xoá nhiệm vụ.
 */
export const TASK_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'RETURNED',
  'IN_PROGRESS',
  'PENDING_CONFIRMATION',
  'COMPLETED',
  'CANCELLED',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_TYPES = ['REGULAR', 'UNEXPECTED', 'KEY'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_PRIORITIES = ['NORMAL', 'HIGH', 'VERY_HIGH'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Mức đánh giá - khách hàng chốt (C2a). */
export const TASK_EVALUATIONS = [
  'EXCELLENT',
  'GOOD',
  'COMPLETED',
  'NOT_COMPLETED',
] as const;
export type TaskEvaluation = (typeof TASK_EVALUATIONS)[number];

/** Bước duyệt - luôn 2 cấp, Trưởng ban chốt (S5). */
export const REVIEW_STAGES = ['DEPUTY', 'HEAD'] as const;
export type ReviewStage = (typeof REVIEW_STAGES)[number];

export const LABELS = {
  status: {
    DRAFT: 'Nháp',
    PENDING_REVIEW: 'Chờ duyệt',
    RETURNED: 'Bị trả lại',
    IN_PROGRESS: 'Đang thực hiện',
    PENDING_CONFIRMATION: 'Chờ xác nhận',
    COMPLETED: 'Đã hoàn thành',
    CANCELLED: 'Đã huỷ',
  } satisfies Record<TaskStatus, string>,
  type: {
    REGULAR: 'Thường xuyên',
    UNEXPECTED: 'Đột xuất',
    KEY: 'Trọng tâm',
  } satisfies Record<TaskType, string>,
  priority: {
    NORMAL: 'Bình thường',
    HIGH: 'Cao',
    VERY_HIGH: 'Rất cao',
  } satisfies Record<TaskPriority, string>,
  evaluation: {
    EXCELLENT: 'Hoàn thành xuất sắc',
    GOOD: 'Hoàn thành tốt',
    COMPLETED: 'Hoàn thành',
    NOT_COMPLETED: 'Không hoàn thành',
  } satisfies Record<TaskEvaluation, string>,
};

/** Hành động ghi vào lịch sử. */
export const HISTORY_ACTIONS = [
  'CREATED',
  'UPDATED',
  'SUBMITTED',
  'APPROVED_STEP',
  'APPROVED',
  'RETURNED',
  'CANCELLED',
  /** Chủ trì (Phó ban) chuyển tiếp cho trợ lý làm người xử lý chính. */
  'FORWARDED',
  /** Chủ trì lấy lại quyền xử lý chính. */
  'RECALLED',
  'PROGRESS',
  /** Người xử lý chính báo cáo hoàn thành. */
  'REPORTED',
  /** Ý kiến trên dòng thời gian. */
  'COMMENT',
  /** Người phối hợp xong phần việc của mình / bỏ đánh dấu. */
  'PART_DONE',
  'PART_UNDONE',
] as const;
export type HistoryAction = (typeof HISTORY_ACTIONS)[number];

/** Ngày nghiệp vụ dạng YYYY-MM-DD - tránh lệch múi giờ khi lưu Date. */
export const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export { BUSINESS_TIMEZONE } from '@/common/constants/time.constants';
