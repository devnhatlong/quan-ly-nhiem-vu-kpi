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

  @NumberNotRequired('Thứ tự sắp xếp', { example: 0 })
  sortOrder?: number;

  @BooleanNotRequired('Trạng thái hoạt động', { example: true })
  isActive?: boolean;
}
