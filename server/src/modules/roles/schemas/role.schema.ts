import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RoleDocument = HydratedDocument<Role>;

@Schema({
  timestamps: true,
})
export class Role {
  @Prop({
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  })
  code!: string;

  @Prop({
    required: true,
    trim: true,
  })
  name!: string;

  @Prop({
    trim: true,
    lowercase: true,
  })
  slug?: string;

  /**
   * Danh sách PermissionEntity.code (lưu trong collection permissions).
   */
  @Prop({
    type: [String],
    default: [],
  })
  permissions!: string[];

  /**
   * Thứ tự hiển thị (nhỏ hơn = đứng trước).
   */
  @Prop({
    required: true,
    default: 0,
    min: 0,
    index: true,
  })
  sortOrder!: number;

  /**
   * Vai trò hệ thống không được phép xóa.
   */
  @Prop({
    default: false,
  })
  isSystem!: boolean;

  @Prop({
    default: true,
    index: true,
  })
  isActive!: boolean;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
