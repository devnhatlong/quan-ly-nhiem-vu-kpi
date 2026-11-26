import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Role, RoleDocument } from './schemas/role.schema';
import { Permission } from '@/common/enums/permission.enum';
import {
  RETIRED_ROLE_CODES,
  RoleCode,
} from '@/common/enums/role-code.enum';
import { Helper } from '@/ultis/helpers';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PermissionsService } from '../permissions/permissions.service';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { buildPaginatedResponse } from '@/common/utils/pagination.util';

const ALL_PERMISSIONS = Object.values(Permission);

/** Quyền xem chung cho vai trò có chức vụ; quyền nghiệp vụ thêm sau. */
const BASE_PERMISSIONS: string[] = [
  Permission.USER_VIEW,
  Permission.DEPARTMENT_VIEW,
];

const SYSTEM_ROLES: Array<{
  code: string;
  name: string;
  sortOrder: number;
  permissions: string[];
}> = [
  {
    code: RoleCode.SUPER_ADMIN,
    name: 'Quản trị hệ thống',
    sortOrder: 10,
    permissions: ALL_PERMISSIONS,
  },
  {
    code: RoleCode.HEAD,
    name: 'Trưởng ban',
    sortOrder: 20,
    // Không có ROLE_ASSIGN / USER_MANAGE: quản lý tài khoản là việc của quản
    // trị hệ thống. Quyền nghiệp vụ (giao, xác nhận nhiệm vụ...) thêm sau.
    permissions: [...BASE_PERMISSIONS, Permission.SUPERVISION_MANAGE],
  },
  {
    code: RoleCode.DEPUTY,
    name: 'Phó ban',
    sortOrder: 30,
    permissions: BASE_PERMISSIONS,
  },
  {
    code: RoleCode.ASSISTANT,
    name: 'Trợ lý',
    sortOrder: 40,
    permissions: [],
  },
];

/**
 * Quyền THÊM MỚI theo thời gian, cấp cho vai trò hệ thống đã nằm sẵn trong CSDL.
 *
 * `seedSystemRoles` ghi `permissions` bằng `$setOnInsert`, nên bổ sung quyền
 * vào SYSTEM_ROLES ở trên chỉ có tác dụng với cơ sở dữ liệu trắng. Bản đã chạy
 * thật thì không bao giờ nhận được quyền mới nếu không có đoạn này.
 */
const GRANTED_PERMISSIONS: Array<{ code: Permission; roles: RoleCode[] }> = [
  { code: Permission.SUPERVISION_MANAGE, roles: [RoleCode.HEAD] },
];

@Injectable()
export class RolesService implements OnModuleInit {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @Inject(forwardRef(() => PermissionsService))
    private readonly permissionsService: PermissionsService,
  ) {}

  async onModuleInit() {
    await this.permissionsService.seedSystemPermissions();
    await this.retireOldSystemRoles();
    await this.seedSystemRoles();
    await this.grantNewSystemPermissions();
  }

  /**
   * Xoá vai trò hệ thống của bản khung cũ và gỡ chúng khỏi tài khoản. Chỉ đụng
   * đúng các mã trong RETIRED_ROLE_CODES và chỉ vai trò hệ thống: vai trò quản
   * trị tự tạo trùng mã thì giữ.
   */
  private async retireOldSystemRoles() {
    const codes = [...RETIRED_ROLE_CODES];
    const { deletedCount } = await this.roleModel.deleteMany({
      code: { $in: codes },
      isSystem: true,
    });
    if (!deletedCount) return;
    await this.roleModel.db
      .collection('users')
      .updateMany(
        { 'roleAssignments.roleCode': { $in: codes } },
        { $pull: { roleAssignments: { roleCode: { $in: codes } } } } as never,
      );
  }

  /**
   * Cấp các quyền mới cho vai trò hệ thống đã tồn tại.
   *
   * Dùng `$addToSet` từng mã một chứ KHÔNG ghi đè cả danh sách: quản trị viên
   * có thể đã chủ động gỡ bớt quyền của một vai trò, ghi đè là xoá mất lựa chọn
   * đó mỗi lần khởi động.
   */
  private async grantNewSystemPermissions() {
    if (!GRANTED_PERMISSIONS.length) return;

    for (const grant of GRANTED_PERMISSIONS) {
      await this.roleModel.updateMany(
        { code: { $in: grant.roles }, isSystem: true },
        { $addToSet: { permissions: grant.code } },
      );
    }
    // SUPER_ADMIN khai quyền bằng danh sách đầy đủ nên phải bù riêng.
    await this.roleModel.updateOne(
      { code: RoleCode.SUPER_ADMIN, isSystem: true },
      {
        $addToSet: {
          permissions: { $each: GRANTED_PERMISSIONS.map((g) => g.code) },
        },
      },
    );
  }

  async create(dto: CreateRoleDto) {
    const code = dto.code.trim().toUpperCase();
    const exists = await this.roleModel.findOne({ code });
    if (exists) {
      throw new BadRequestException('Mã vai trò đã tồn tại.');
    }

    const permissions = (dto.permissions ?? []).map((p) =>
      p.trim().toLowerCase(),
    );
    await this.permissionsService.assertCodesExist(permissions);

    const role = await this.roleModel.create({
      code,
      name: dto.name.trim(),
      slug: Helper.slugify(dto.name),
      permissions,
      sortOrder: dto.sortOrder ?? 0,
      isSystem: false,
      isActive: dto.isActive ?? true,
    });

    return {
      message: 'Tạo vai trò thành công.',
      data: role,
    };
  }

  async findAll(query: PaginationQueryDto = new PaginationQueryDto()) {
    const filter: Record<string, unknown> = {};
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ code: regex }, { name: regex }];
    }

    const sort = { sortOrder: 1 as const, code: 1 as const };

    if (query.all) {
      const data = await this.roleModel.find(filter).sort(sort);
      return buildPaginatedResponse(data, data.length, 1, data.length || 1);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.roleModel.find(filter).sort(sort).skip(skip).limit(limit),
      this.roleModel.countDocuments(filter),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    return this.requireRole(id);
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.requireRole(id);

    if (dto.name !== undefined) {
      role.name = dto.name.trim();
      role.slug = Helper.slugify(dto.name);
    }
    if (dto.permissions !== undefined) {
      const permissions = dto.permissions.map((p) => p.trim().toLowerCase());
      await this.permissionsService.assertCodesExist(permissions);
      role.permissions = permissions;
    }
    if (dto.sortOrder !== undefined) {
      role.sortOrder = dto.sortOrder;
    }
    if (dto.isActive !== undefined) {
      role.isActive = dto.isActive;
    }

    await role.save();

    return {
      message: 'Cập nhật vai trò thành công.',
      data: role,
    };
  }

  async remove(id: string) {
    const role = await this.requireRole(id);
    if (role.isSystem) {
      throw new BadRequestException('Không thể xóa vai trò hệ thống.');
    }

    await role.deleteOne();

    return { message: 'Xóa vai trò thành công.' };
  }

  async getPermissionsByCodes(codes: string[]): Promise<string[]> {
    if (!codes.length) {
      return [];
    }

    const normalized = codes.map((c) => c.trim().toUpperCase());
    const roles = await this.roleModel
      .find({
        code: { $in: normalized },
        isActive: true,
      })
      .select('permissions')
      .lean();

    const set = new Set<string>();
    for (const role of roles) {
      for (const permission of role.permissions ?? []) {
        set.add(permission);
      }
    }

    return [...set];
  }

  /** Mã các vai trò đang hoạt động có một quyền cụ thể. */
  async findCodesByPermission(permission: string): Promise<string[]> {
    const roles = await this.roleModel
      .find({ permissions: permission, isActive: true })
      .select('code')
      .lean();
    return roles.map((role) => role.code);
  }

  async seedSystemRoles() {
    for (const role of SYSTEM_ROLES) {
      await this.roleModel.updateOne(
        { code: role.code },
        {
          $setOnInsert: {
            code: role.code,
            name: role.name,
            slug: Helper.slugify(role.name),
            permissions: role.permissions,
            isSystem: true,
            isActive: true,
          },
          $set: {
            sortOrder: role.sortOrder,
          },
        },
        { upsert: true },
      );
    }
  }

  private async requireRole(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Không tìm thấy vai trò.');
    }

    const role = await this.roleModel.findById(id);
    if (!role) {
      throw new NotFoundException('Không tìm thấy vai trò.');
    }

    return role;
  }
}
