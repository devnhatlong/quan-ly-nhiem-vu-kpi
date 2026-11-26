import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import {
  REVIEW_STAGES,
  TASK_EVALUATIONS,
  TASK_PRIORITIES,
  TASK_SOURCES,
  TASK_STATUSES,
  TASK_TYPES,
  type ReviewStage,
  type TaskEvaluation,
  type TaskPriority,
  type TaskSource,
  type TaskStatus,
  type TaskType,
} from '../task.constants';

/** Con trỏ tới tệp trong GridFS - độ mật chép từ lúc tải lên, không lấy từ client. */
@Schema({ _id: false })
export class TaskAttachment {
  @Prop({ type: Types.ObjectId, required: true })
  id!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: 0 })
  size!: number;

  @Prop({ default: '' })
  mimeType!: string;

  @Prop({ type: String, default: null })
  classification!: string | null;
}
export const TaskAttachmentSchema =
  SchemaFactory.createForClass(TaskAttachment);

/** Đang chờ ai duyệt. Có giá trị khi status là PENDING_REVIEW / PENDING_CONFIRMATION. */
@Schema({ _id: false })
export class TaskReview {
  @Prop({ type: String, enum: ['SUBMISSION', 'COMPLETION'], required: true })
  kind!: 'SUBMISSION' | 'COMPLETION';

  @Prop({ type: String, enum: REVIEW_STAGES, required: true })
  stage!: ReviewStage;

  /**
   * Phó ban duyệt bước 1 - chốt lúc gửi theo bảng Phân công phụ trách. null =
   * đi thẳng Trưởng ban (trợ lý trực thuộc Trưởng ban, hoặc Phó ban tự khai).
   */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  deputyId!: Types.ObjectId | null;

  @Prop({ type: Date, required: true })
  since!: Date;
}
export const TaskReviewSchema = SchemaFactory.createForClass(TaskReview);

/** Đề xuất của Phó ban ở bước 1 - Trưởng ban giữ nguyên hoặc sửa khi chốt. */
@Schema({ _id: false })
export class TaskProposal {
  @Prop({ type: String, enum: TASK_TYPES, default: null })
  type!: TaskType | null;

  @Prop({ type: String, enum: TASK_PRIORITIES, default: null })
  priority!: TaskPriority | null;

  @Prop({ type: String, enum: TASK_EVALUATIONS, default: null })
  evaluation!: TaskEvaluation | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  byId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  at!: Date;
}
export const TaskProposalSchema = SchemaFactory.createForClass(TaskProposal);

@Schema({ _id: false })
export class TaskEvent {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  byId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  at!: Date;

  @Prop({ default: '' })
  reason!: string;
}
export const TaskEventSchema = SchemaFactory.createForClass(TaskEvent);

/**
 * Người phối hợp đánh dấu xong phần việc của mình - chỉ là dấu riêng của người
 * đó, không đổi trạng thái nhiệm vụ (chủ trì / người xử lý chính mới báo hoàn
 * thành cả nhiệm vụ).
 */
@Schema({ _id: false })
export class CollaboratorDone {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  at!: Date;

  @Prop({ default: '' })
  note!: string;
}
export const CollaboratorDoneSchema =
  SchemaFactory.createForClass(CollaboratorDone);

/**
 * Nhiệm vụ - các trường theo §5 tài liệu sáng kiến. Không bao giờ xoá: giao
 * nhầm thì huỷ kèm lý do; mọi thay đổi ghi vào TaskHistory.
 */
@Schema({ timestamps: true, collection: 'tasks' })
export class Task {
  /** VD TMKH-2026-001. Bản tự khai nhận mã khi gửi lần đầu (K1). */
  @Prop({ type: String, default: undefined })
  code?: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Department',
    required: true,
    index: true,
  })
  departmentId!: Types.ObjectId;

  @Prop({ type: String, enum: TASK_SOURCES, required: true })
  source!: TaskSource;

  @Prop({ required: true, trim: true })
  content!: string;

  /** Căn cứ: kế hoạch, công văn, ý kiến chỉ huy... */
  @Prop({ trim: true, default: '' })
  basis!: string;

  /** Bản tự khai chưa duyệt thì chưa có - người duyệt đặt (S3). */
  @Prop({ type: String, enum: TASK_TYPES, default: null })
  type!: TaskType | null;

  @Prop({ type: String, enum: TASK_PRIORITIES, default: null })
  priority!: TaskPriority | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdById!: Types.ObjectId;

  /** Người giao. null với bản tự khai. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  assignerId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    default: [],
    index: true,
  })
  collaboratorIds!: Types.ObjectId[];

  /**
   * Người xử lý chính hiện tại - người duy nhất cập nhật tiến độ và báo hoàn
   * thành. Mặc định là chủ trì; chủ trì là Phó ban thì chuyển tiếp được cho trợ
   * lý mình phụ trách. null (dữ liệu cũ) = chủ trì.
   */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  handlerId!: Types.ObjectId | null;

  /** Người từng xử lý chính rồi bị chuyển / thu hồi - vẫn xem và cho ý kiến được. */
  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    default: [],
    index: true,
  })
  formerHandlerIds!: Types.ObjectId[];

  /** Người phối hợp đã xong phần việc của mình. */
  @Prop({ type: [CollaboratorDoneSchema], default: [] })
  collaboratorDone!: CollaboratorDone[];

  /** Ai chuyển tiếp cho người xử lý chính (Phó ban chủ trì). null = chưa chuyển. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  forwardedById!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  startDate!: string | null;

  @Prop({ type: String, default: null })
  dueDate!: string | null;

  /** Ngày giao / ngày bản tự khai được chốt. */
  @Prop({ type: Date, default: null })
  assignedAt!: Date | null;

  @Prop({ default: 0, min: 0, max: 100 })
  progress!: number;

  @Prop({ type: String, enum: TASK_STATUSES, required: true, index: true })
  status!: TaskStatus;

  /** Bản tự khai việc ĐÃ LÀM XONG (S9) - chốt là thành Đã hoàn thành luôn. */
  @Prop({ default: false })
  reportedDone!: boolean;

  @Prop({ trim: true, default: '' })
  result!: string;

  @Prop({ type: [TaskAttachmentSchema], default: [] })
  attachments!: TaskAttachment[];

  /** Văn bản / sản phẩm kèm báo cáo hoàn thành (khác tài liệu lúc giao). */
  @Prop({ type: [TaskAttachmentSchema], default: [] })
  resultAttachments!: TaskAttachment[];

  /** Lúc người xử lý chính báo cáo hoàn thành gần nhất. */
  @Prop({ type: Date, default: null })
  reportedAt!: Date | null;

  @Prop({ type: TaskReviewSchema, default: null })
  review!: TaskReview | null;

  @Prop({ type: TaskProposalSchema, default: null })
  proposal!: TaskProposal | null;

  @Prop({ type: TaskEventSchema, default: null })
  lastReturn!: TaskEvent | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  approvedById!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  confirmedById!: Types.ObjectId | null;

  @Prop({ type: String, enum: TASK_EVALUATIONS, default: null })
  evaluation!: TaskEvaluation | null;

  @Prop({ type: TaskEventSchema, default: null })
  cancellation!: TaskEvent | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export type TaskDocument = HydratedDocument<Task>;
export const TaskSchema = SchemaFactory.createForClass(Task);

TaskSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } } },
);
TaskSchema.index({ departmentId: 1, status: 1, updatedAt: -1 });
TaskSchema.index({ 'review.deputyId': 1, status: 1 });
