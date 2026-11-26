import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { RoleCode } from '@/common/enums/role-code.enum';
import type { JwtPayloadUser } from '@/common/interfaces/jwt-payload-user.interface';
import { User, UserDocument } from '@/modules/users/schemas/user.schema';
import {
  Department,
  DepartmentDocument,
} from '@/modules/departments/schemas/department.schema';

type Member = {
  id: string;
  username: string;
  fullName: string;
  rank: string;
  position: string;
};

function hasRole(
  assignments: Array<{ roleCode?: string }> | undefined,
  role: RoleCode,
): boolean {
  return (assignments ?? []).some((item) => item?.roleCode === role);
}

function toMember(user: {
  _id: Types.ObjectId;
  username: string;
  fullName?: string;
  rank?: string;
  position?: string;
}): Member {
  return {
    id: String(user._id),
    username: user.username,
    fullName: user.fullName?.trim() || user.username,
    rank: user.rank ?? '',
    position: user.position ?? '',
  };
}

/**
 * Phân công Phó ban phụ trách trợ lý trong một Ban.
 *
 * Mỗi trợ lý có tối đa MỘT Phó ban phụ trách (`User.supervisorId`); để trống
 * là Trưởng ban trực tiếp. Đây là "phạm vi được giao" của Phó ban (§13 tài liệu
 * sáng kiến) và là nơi luồng báo cáo lên của trợ lý đi tới.
 *
 * Trưởng ban chỉ chỉnh được Ban mình làm Trưởng ban; quản trị hệ thống chỉnh
 * được mọi Ban.
 */
@Injectable()
export class SupervisionService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
  ) {}

  async overview(actor: JwtPayloadUser, departmentId?: string) {
    const departments = await this.manageableDepartments(actor);
    if (!departments.length) {
      return {
        message: 'OK',
        data: {
          departments: [],
          department: null,
          heads: [],
          deputies: [],
          assistants: [],
        },
      };
    }

    let department = departments[0];
    if (departmentId) {
      const picked = departments.find((d) => String(d._id) === departmentId);
      if (!picked) {
        throw new ForbiddenException('Bạn không quản lý đơn vị này.');
      }
      department = picked;
    }

    const members = await this.userModel
      .find({ departmentId: department._id, isActive: true })
      .select('username fullName rank position roleAssignments supervisorId')
      .sort({ fullName: 1, username: 1 })
      .lean();

    const deputies = members.filter((u) =>
      hasRole(u.roleAssignments, RoleCode.DEPUTY),
    );
    const deputyIds = new Set(deputies.map((u) => String(u._id)));

    return {
      message: 'OK',
      data: {
        departments: departments.map((d) => ({
          id: String(d._id),
          code: d.code,
          name: d.name,
        })),
        department: {
          id: String(department._id),
          code: department.code,
          name: department.name,
        },
        heads: members
          .filter((u) => hasRole(u.roleAssignments, RoleCode.HEAD))
          .map(toMember),
        deputies: deputies.map(toMember),
        assistants: members
          .filter((u) => hasRole(u.roleAssignments, RoleCode.ASSISTANT))
          .map((u) => {
            const supervisorId = u.supervisorId ? String(u.supervisorId) : null;
            return {
              ...toMember(u),
              // Phó ban đã bị khoá / chuyển đi thì coi như chưa phân công.
              supervisorId:
                supervisorId && deputyIds.has(supervisorId)
                  ? supervisorId
                  : null,
            };
          }),
      },
    };
  }

  /**
   * Đặt ĐÚNG danh sách trợ lý do một Phó ban phụ trách: trợ lý trong danh sách
   * chuyển về Phó ban này (kể cả đang thuộc Phó ban khác - mỗi trợ lý chỉ một
   * người phụ trách), trợ lý của Phó ban này mà bị bỏ khỏi danh sách thì về
   * Trưởng ban trực tiếp.
   */
  async setDeputyAssistants(
    actor: JwtPayloadUser,
    deputyId: string,
    assistantIds: string[],
  ) {
    if (!Types.ObjectId.isValid(deputyId)) {
      throw new NotFoundException('Không tìm thấy Phó ban.');
    }
    const deputy = await this.userModel
      .findById(deputyId)
      .select('isActive roleAssignments departmentId')
      .lean();
    const deptId = deputy?.departmentId;
    if (
      !deputy ||
      !deptId ||
      !deputy.isActive ||
      !hasRole(deputy.roleAssignments, RoleCode.DEPUTY)
    ) {
      throw new NotFoundException('Không tìm thấy Phó ban đang hoạt động.');
    }

    const departments = await this.manageableDepartments(actor);
    if (!departments.some((d) => d._id.equals(deptId))) {
      throw new ForbiddenException('Bạn không quản lý đơn vị của Phó ban này.');
    }

    const ids = [...new Set(assistantIds)].map((id) => new Types.ObjectId(id));
    const valid = await this.userModel.countDocuments({
      _id: { $in: ids },
      departmentId: deptId,
      isActive: true,
      'roleAssignments.roleCode': RoleCode.ASSISTANT,
    });
    if (valid !== ids.length) {
      throw new BadRequestException(
        'Danh sách có người không phải trợ lý đang hoạt động của cùng đơn vị.',
      );
    }

    const owner = new Types.ObjectId(deputyId);
    await this.userModel.updateMany(
      { supervisorId: owner, _id: { $nin: ids } },
      { $set: { supervisorId: null } },
    );
    if (ids.length) {
      await this.userModel.updateMany(
        { _id: { $in: ids } },
        { $set: { supervisorId: owner } },
      );
    }

    return {
      message: 'Đã lưu phân công.',
      data: { deputyId, assistantIds: ids.map(String) },
    };
  }

  /**
   * Các Ban người này được phân công phụ trách: quản trị hệ thống thì tất cả;
   * Trưởng ban thì Ban ghi trên vai trò HEAD (hoặc đơn vị công tác nếu vai trò
   * không gắn đơn vị).
   */
  private async manageableDepartments(actor: JwtPayloadUser) {
    const roles = actor.role ?? [];
    if (hasRole(roles, RoleCode.SUPER_ADMIN)) {
      return this.departmentModel
        .find({ isActive: true })
        .sort({ sortOrder: 1, name: 1 })
        .lean();
    }

    const ids = new Set<string>();
    for (const r of roles) {
      if (!hasRole([r], RoleCode.HEAD)) continue;
      if (r.scopeDepartmentId) {
        ids.add(r.scopeDepartmentId);
      } else {
        const me = await this.userModel
          .findById(actor.uid)
          .select('departmentId')
          .lean();
        if (me?.departmentId) ids.add(String(me.departmentId));
      }
    }
    if (!ids.size) return [];
    return this.departmentModel
      .find({
        _id: { $in: [...ids].map((id) => new Types.ObjectId(id)) },
        isActive: true,
      })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
  }
}
