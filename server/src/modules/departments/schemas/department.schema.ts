import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DepartmentDocument = HydratedDocument<Department>;

/** Đơn vị (Ban...). Danh sách phẳng - không có đơn vị cha / con. */
@Schema({
  timestamps: true,
})
export class Department {
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

  @Prop({
    default: 0,
  })
  sortOrder!: number;

  @Prop({
    default: true,
    index: true,
  })
  isActive!: boolean;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);

DepartmentSchema.index({ sortOrder: 1, name: 1 });
