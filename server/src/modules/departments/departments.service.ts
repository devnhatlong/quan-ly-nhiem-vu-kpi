import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Helper } from '@/ultis/helpers';
import { Department, DepartmentDocument } from './schemas/department.schema';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { ImportDepartmentRowDto } from './dto/import-departments.dto';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { buildPaginatedResponse } from '@/common/utils/pagination.util';

type ImportRowResult = {
  row: number;
  code: string;
  status: 'created' | 'skipped' | 'error';
  message: string;
};

/** Đơn vị là danh sách phẳng - không có đơn vị cha / con. */
@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
  ) {}

  async create(dto: CreateDepartmentDto) {
    const code = dto.code.trim().toUpperCase();
    const exists = await this.departmentModel.findOne({ code });
    if (exists) {
      throw new BadRequestException('Mã đơn vị đã tồn tại.');
    }

    const department = await this.departmentModel.create({
      code,
      name: dto.name.trim(),
      slug: Helper.slugify(dto.name),
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });

    return {
      message: 'Tạo đơn vị thành công.',
      data: department,
    };
  }

  async findAll(query: PaginationQueryDto = new PaginationQueryDto()) {
    const filter: Record<string, unknown> = {};
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ code: regex }, { name: regex }];
    }

    const sort = { sortOrder: 1 as const, name: 1 as const };

    if (query.all) {
      const data = await this.departmentModel.find(filter).sort(sort);
      return buildPaginatedResponse(data, data.length, 1, data.length || 1);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.departmentModel.find(filter).sort(sort).skip(skip).limit(limit),
      this.departmentModel.countDocuments(filter),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    return this.requireDepartment(id);
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const department = await this.requireDepartment(id);

    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase();
      const exists = await this.departmentModel.findOne({
        code,
        _id: { $ne: department._id },
      });
      if (exists) {
        throw new BadRequestException('Mã đơn vị đã tồn tại.');
      }
      department.code = code;
    }

    if (dto.name !== undefined) {
      department.name = dto.name.trim();
      department.slug = Helper.slugify(dto.name);
    }

    if (dto.sortOrder !== undefined) {
      department.sortOrder = dto.sortOrder;
    }
    if (dto.isActive !== undefined) {
      department.isActive = dto.isActive;
    }

    await department.save();

    return {
      message: 'Cập nhật đơn vị thành công.',
      data: department,
    };
  }

  /**
   * Không xoá đơn vị còn tài khoản: xoá đi thì các tài khoản đó trỏ vào một
   * đơn vị không còn, mất luôn Trưởng ban / Phó ban / phân công phụ trách.
   * Đọc thẳng collection users - kéo UsersModule vào đây là vòng phụ thuộc.
   */
  async remove(id: string) {
    const department = await this.requireDepartment(id);
    const members = await this.departmentModel.db
      .collection('users')
      .countDocuments({ departmentId: department._id });
    if (members > 0) {
      throw new BadRequestException(
        `Không thể xoá đơn vị còn ${members} tài khoản. Chuyển hoặc xoá các tài khoản đó trước.`,
      );
    }

    await department.deleteOne();

    return { message: 'Xóa đơn vị thành công.' };
  }

  /** Import theo mã. Mã đã tồn tại → bỏ qua (không ghi đè). */
  async importMany(rows: ImportDepartmentRowDto[]) {
    const results: ImportRowResult[] = [];
    const existing = await this.departmentModel.find().select('code');
    const codes = new Set(existing.map((d) => d.code.toUpperCase()));

    for (const [i, row] of rows.entries()) {
      const index = i + 1;
      const code = String(row.code ?? '')
        .trim()
        .toUpperCase();
      const name = String(row.name ?? '').trim();

      if (!code || !name) {
        results.push({
          row: index,
          code: code || '(trống)',
          status: 'error',
          message: 'Thiếu mã hoặc tên đơn vị.',
        });
        continue;
      }
      if (codes.has(code)) {
        results.push({
          row: index,
          code,
          status: 'skipped',
          message: 'Mã đơn vị đã tồn tại.',
        });
        continue;
      }

      try {
        await this.create({
          code,
          name,
          sortOrder: row.sortOrder ?? 0,
          isActive: row.isActive ?? true,
        });
        codes.add(code);
        results.push({
          row: index,
          code,
          status: 'created',
          message: 'Đã tạo đơn vị.',
        });
      } catch (error) {
        results.push({
          row: index,
          code,
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Lỗi không xác định.',
        });
      }
    }

    const summary = {
      total: rows.length,
      created: results.filter((r) => r.status === 'created').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
    };

    return {
      message: `Import xong: ${summary.created} tạo mới, ${summary.skipped} bỏ qua, ${summary.errors} lỗi.`,
      data: { summary, results },
    };
  }

  private async requireDepartment(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Không tìm thấy đơn vị.');
    }

    const department = await this.departmentModel.findById(id);
    if (!department) {
      throw new NotFoundException('Không tìm thấy đơn vị.');
    }

    return department;
  }
}
