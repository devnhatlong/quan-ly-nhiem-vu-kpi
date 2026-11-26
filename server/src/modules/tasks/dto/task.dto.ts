import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  TASK_EVALUATIONS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  YMD_PATTERN,
  type TaskEvaluation,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
} from '../task.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Trường chung của nhiệm vụ giao và bản tự khai. */
class TaskFieldsDto {
  @ApiPropertyOptional({
    description: 'Căn cứ: kế hoạch, công văn, ý kiến chỉ huy...',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trim)
  basis?: string;

  @ApiPropertyOptional({ type: [String], description: 'Id người phối hợp' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsMongoId({ each: true, message: 'Người phối hợp không hợp lệ.' })
  collaboratorIds?: string[];

  @ApiPropertyOptional({ example: '2026-11-26' })
  @IsOptional()
  @Matches(YMD_PATTERN, { message: 'Ngày bắt đầu phải có dạng YYYY-MM-DD.' })
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-05' })
  @IsOptional()
  @Matches(YMD_PATTERN, { message: 'Hạn hoàn thành phải có dạng YYYY-MM-DD.' })
  dueDate?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Id tệp đã tải lên (/uploads)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsMongoId({ each: true, message: 'Tệp đính kèm không hợp lệ.' })
  attachmentIds?: string[];
}

/** Trưởng ban / Phó ban giao nhiệm vụ (luồng từ trên xuống). */
export class CreateAssignedTaskDto extends TaskFieldsDto {
  @ApiProperty({ example: 'Xây dựng báo cáo tổng kết năm' })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung nhiệm vụ không được để trống.' })
  @MaxLength(4000)
  @Transform(trim)
  content!: string;

  @ApiProperty({ enum: TASK_TYPES })
  @IsIn(TASK_TYPES, { message: 'Loại nhiệm vụ không hợp lệ.' })
  type!: TaskType;

  @ApiProperty({ enum: TASK_PRIORITIES })
  @IsIn(TASK_PRIORITIES, { message: 'Mức độ ưu tiên không hợp lệ.' })
  priority!: TaskPriority;

  @ApiProperty({ description: 'Id người chủ trì' })
  @IsMongoId({ message: 'Người chủ trì không hợp lệ.' })
  ownerId!: string;

  @ApiProperty({ example: '2026-12-05' })
  @Matches(YMD_PATTERN, { message: 'Hạn hoàn thành phải có dạng YYYY-MM-DD.' })
  declare dueDate: string;
}

/** Sửa nhiệm vụ được giao - người giao hoặc Trưởng ban. */
export class UpdateAssignedTaskDto extends TaskFieldsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Nội dung nhiệm vụ không được để trống.' })
  @MaxLength(4000)
  @Transform(trim)
  content?: string;

  @ApiPropertyOptional({ enum: TASK_TYPES })
  @IsOptional()
  @IsIn(TASK_TYPES, { message: 'Loại nhiệm vụ không hợp lệ.' })
  type?: TaskType;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsIn(TASK_PRIORITIES, { message: 'Mức độ ưu tiên không hợp lệ.' })
  priority?: TaskPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId({ message: 'Người chủ trì không hợp lệ.' })
  ownerId?: string;
}

/**
 * Bản tự khai (luồng từ dưới lên). Không có loại / mức độ: người duyệt đặt
 * (S3). `submit` = gửi luôn, không thì lưu nháp.
 */
export class SelfReportDto extends TaskFieldsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(trim)
  content?: string;

  @ApiPropertyOptional({ description: 'true = việc đã làm xong (S9)' })
  @IsOptional()
  @IsBoolean()
  reportedDone?: boolean;

  @ApiPropertyOptional({ description: 'Kết quả - bắt buộc khi đã làm xong' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  @Transform(trim)
  result?: string;

  @ApiPropertyOptional({ description: 'true = gửi duyệt ngay' })
  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

export class ApproveTaskDto {
  @ApiPropertyOptional({ enum: TASK_TYPES })
  @IsOptional()
  @IsIn(TASK_TYPES, { message: 'Loại nhiệm vụ không hợp lệ.' })
  type?: TaskType;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsIn(TASK_PRIORITIES, { message: 'Mức độ ưu tiên không hợp lệ.' })
  priority?: TaskPriority;

  @ApiPropertyOptional({
    enum: TASK_EVALUATIONS,
    description: 'Với việc đã làm xong',
  })
  @IsOptional()
  @IsIn(TASK_EVALUATIONS, { message: 'Mức đánh giá không hợp lệ.' })
  evaluation?: TaskEvaluation;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trim)
  note?: string;
}

export class ReturnTaskDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do trả lại.' })
  @MaxLength(2000)
  @Transform(trim)
  reason!: string;

  /** PREVIOUS = về Phó ban (chỉ ở bước Trưởng ban); START = về người lập (S7). */
  @ApiPropertyOptional({ enum: ['PREVIOUS', 'START'], default: 'START' })
  @IsOptional()
  @IsIn(['PREVIOUS', 'START'])
  to?: 'PREVIOUS' | 'START';
}

export class CancelTaskDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do huỷ.' })
  @MaxLength(2000)
  @Transform(trim)
  reason!: string;
}

export const TASK_VIEWS = ['mine', 'assigned', 'review', 'all'] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export class TaskListQueryDto {
  @ApiPropertyOptional({ enum: TASK_VIEWS, default: 'mine' })
  @IsOptional()
  @IsIn(TASK_VIEWS)
  view?: TaskView;

  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trim)
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
