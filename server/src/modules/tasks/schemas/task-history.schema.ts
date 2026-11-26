import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { HISTORY_ACTIONS, type HistoryAction } from '../task.constants';

/** Một trường bị đổi - giá trị chụp sẵn thành chữ (tên người, nhãn tiếng Việt). */
@Schema({ _id: false })
export class FieldChange {
  @Prop({ required: true })
  field!: string;

  @Prop({ default: '' })
  from!: string;

  @Prop({ default: '' })
  to!: string;
}
export const FieldChangeSchema = SchemaFactory.createForClass(FieldChange);

/**
 * Lịch sử nhiệm vụ - CHỈ GHI THÊM. Không route nào sửa hay xoá bản ghi ở đây
 * (§5, §13 tài liệu sáng kiến: ai sửa, sửa lúc nào, từ gì thành gì).
 *
 * Giá trị và tên người được chụp thành chữ lúc ghi: người đổi tên hay chuyển
 * đơn vị về sau thì lịch sử vẫn đọc đúng như lúc xảy ra.
 */
@Schema({ collection: 'task_histories' })
export class TaskHistory {
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  taskId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorId!: Types.ObjectId;

  /** Tên người thao tác lúc đó, VD "Đại úy Hoàng Thu Trang". */
  @Prop({ required: true })
  actorName!: string;

  @Prop({ type: String, enum: HISTORY_ACTIONS, required: true })
  action!: HistoryAction;

  @Prop({ default: '' })
  note!: string;

  @Prop({ type: [FieldChangeSchema], default: [] })
  changes!: FieldChange[];

  @Prop({ type: Date, required: true, default: () => new Date() })
  at!: Date;
}

export type TaskHistoryDocument = HydratedDocument<TaskHistory>;
export const TaskHistorySchema = SchemaFactory.createForClass(TaskHistory);
TaskHistorySchema.index({ taskId: 1, at: 1 });
