import {
  BooleanNotRequired,
  NumberNotRequired,
  StringRequired,
} from '@/common/decorators';

export class CreateDepartmentDto {
  @StringRequired('Mã đơn vị', { example: 'TMKH' })
  code!: string;

  @StringRequired('Tên đơn vị', { example: 'Phòng 1' })
  name!: string;

  @NumberNotRequired('Thứ tự sắp xếp', { example: 0 })
  sortOrder?: number;

  @BooleanNotRequired('Trạng thái hoạt động', { example: true })
  isActive?: boolean;
}
