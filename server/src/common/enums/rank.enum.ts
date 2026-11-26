import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Cấp bậc hàm (hạ sĩ quan - binh sĩ, sĩ quan cấp úy, tá, tướng).
 *
 * Xếp từ THẤP LÊN CAO, không xếp theo thứ tự người dùng gõ vào: danh sách 17 mục mà chỗ tăng dần chỗ giảm dần
 * thì người chọn phải dò từng dòng, còn xếp một chiều thì mắt lướt là ra.
 *
 * Bốn nhóm liền mạch trong cùng một mảng - dropdown của dự án chưa có tiêu đề
 * nhóm, mà bốn nhóm này tự phân biệt bằng chính chữ cuối (sĩ / úy / tá / tướng)
 * nên không cần thêm nhãn.
 *
 * Danh sách này ĐƯỢC NHÂN BẢN ở client (`client/src/features/organization/
 * rank.ts`). Sửa một bên phải sửa bên kia, nếu không thì server trả 400
 * cho đúng cái giá trị mà giao diện vừa bày ra cho người dùng chọn.
 */
export const RANKS = [
  // Hạ sĩ quan, binh sĩ
  'Binh nhì',
  'Binh nhất',
  'Hạ sĩ',
  'Trung sĩ',
  'Thượng sĩ',
  // Sĩ quan cấp úy
  'Thiếu úy',
  'Trung úy',
  'Thượng úy',
  'Đại úy',
  // Sĩ quan cấp tá
  'Thiếu tá',
  'Trung tá',
  'Thượng tá',
  'Đại tá',
  // Sĩ quan cấp tướng
  'Thiếu tướng',
  'Trung tướng',
  'Thượng tướng',
  'Đại tướng',
] as const;

export type Rank = (typeof RANKS)[number];

/**
 * Trường cấp bậc dùng chung cho mọi DTO có người dùng.
 *
 * Gói thành một decorator thay vì chép bộ `@IsOptional @IsString @IsIn` vào
 * từng DTO: bốn chỗ khai tay là bốn chỗ có thể quên cập nhật khi danh mục đổi,
 * mà chỗ quên sẽ nhận bừa cấp bậc không có thật thay vì trả lỗi.
 *
 * Nhận chuỗi rỗng để người dùng bỏ trống được cấp bậc đã đặt nhầm.
 */
export const IsRank = () =>
  applyDecorators(
    ApiPropertyOptional({
      description: 'Cấp bậc hàm',
      enum: RANKS,
      example: 'Đại úy',
    }),
    IsOptional(),
    IsString({ message: 'Cấp bậc phải là một chuỗi.' }),
    IsIn([...RANKS, ''], {
      message: 'Cấp bậc không nằm trong danh mục cấp bậc hàm.',
    }),
  );
