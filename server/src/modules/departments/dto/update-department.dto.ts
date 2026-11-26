import {
  BooleanNotRequired,
  NumberNotRequired,
  StringNotRequired,
} from '@/common/decorators';

export class UpdateDepartmentDto {
  @StringNotRequired('Mã đơn vị', { example: 'TMKH' })
  code?: string;

  @StringNotRequired('Tên đơn vị', { example: 'Phòng 1' })
  name?: string;

  @StringNotRequired('Mã đơn vị cha', {
    example: '507f1f77bcf86cd799439011',
  })
  parentId?: string | null;

  @NumberNotRequired('Thứ tự sắp xếp', { example: 0 })
  sortOrder?: number;

  @BooleanNotRequired('Trạng thái hoạt động', { example: true })
  isActive?: boolean;
}
