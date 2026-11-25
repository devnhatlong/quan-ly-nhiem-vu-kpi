import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

import { RoleCode } from '@/common/enums/role-code.enum';
import { UploadsService } from './uploads.service';

/** Đi ngược cây đơn vị tối đa chừng này bậc - đủ cho tỉnh → phòng → đội → tổ. */
const MAX_DEPARTMENT_DEPTH = 10;

type UserLite = {
  _id: Types.ObjectId;
  departmentId?: Types.ObjectId | null;
  roleAssignments?: Array<{ roleCode?: string }>;
};

/**
 * Ai được tải / xem một tệp đã upload.
 *
 * Trước đây chỉ cần đăng nhập là tải được mọi tệp theo id - mà id GridFS là
 * ObjectId, sinh gần như tăng dần, biết một id là dò ra các id khác. Luật ở đây
 * đi theo đúng đường tệp được nhìn thấy trong nghiệp vụ:
 *
 * 1. Chính người upload, hoặc quản trị hệ thống.
 * 2. Cùng đơn vị với người upload (tài khoản đội dùng chung, tài khoản duyệt
 *    cùng đơn vị).
 * 3. Đơn vị cấp trên của đơn vị người upload (phòng đọc báo cáo đội, tỉnh đọc
 *    phòng...) - đi ngược `parentId`.
 *
 * Nghiệp vụ mới cần mở tệp cho nơi nhận đi NGANG (ngoài cây đơn vị) thì thêm
 * luật vào `canRead`.
 *
 * Đọc thẳng collection chứ không đi qua service nghiệp vụ: module upload đứng
 * dưới mọi module khác, kéo ngược lên là vòng phụ thuộc.
 */
@Injectable()
export class UploadAccessService {
  private readonly logger = new Logger(UploadAccessService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly uploads: UploadsService,
  ) {}

  async assertCanRead(viewerId: string, uploadId: string): Promise<void> {
    if (await this.canRead(viewerId, uploadId)) return;
    // Ghi lại để quản trị thấy nếu luật chặn nhầm một luồng hợp lệ.
    this.logger.warn(
      `Chặn tải tệp ${uploadId} của tài khoản ${viewerId} - không thuộc luồng nào được xem.`,
    );
    throw new ForbiddenException('Bạn không có quyền xem tệp này.');
  }

  private async canRead(viewerId: string, uploadId: string): Promise<boolean> {
    const uploaderId = await this.uploads.uploaderOf(uploadId);
    // Không có tệp: để bước mở tệp phía sau báo 404 như cũ.
    if (uploaderId === null) return true;
    if (uploaderId && uploaderId === viewerId) return true;
    if (!Types.ObjectId.isValid(viewerId)) return false;

    const users = this.connection.collection<UserLite>('users');
    const viewer = await users.findOne(
      { _id: new Types.ObjectId(viewerId) },
      { projection: { departmentId: 1, roleAssignments: 1 } },
    );
    if (!viewer) return false;
    if (
      (viewer.roleAssignments ?? []).some(
        (item) => item?.roleCode === RoleCode.SUPER_ADMIN,
      )
    ) {
      return true;
    }

    const viewerDept = viewer.departmentId ? String(viewer.departmentId) : '';

    if (viewerDept && uploaderId && Types.ObjectId.isValid(uploaderId)) {
      const uploader = await users.findOne(
        { _id: new Types.ObjectId(uploaderId) },
        { projection: { departmentId: 1 } },
      );
      const uploaderDept = uploader?.departmentId
        ? String(uploader.departmentId)
        : '';
      if (
        uploaderDept &&
        (await this.isSameOrAncestor(viewerDept, uploaderDept))
      ) {
        return true;
      }
    }

    return false;
  }

  /** `ancestorId` là chính `deptId` hoặc một đơn vị cấp trên của nó. */
  private async isSameOrAncestor(
    ancestorId: string,
    deptId: string,
  ): Promise<boolean> {
    const departments = this.connection.collection<{
      _id: Types.ObjectId;
      parentId?: Types.ObjectId | null;
    }>('departments');
    let current: string | null = deptId;
    for (let depth = 0; current && depth < MAX_DEPARTMENT_DEPTH; depth += 1) {
      if (current === ancestorId) return true;
      if (!Types.ObjectId.isValid(current)) return false;
      const dept: { parentId?: Types.ObjectId | null } | null =
        await departments.findOne(
          { _id: new Types.ObjectId(current) },
          { projection: { parentId: 1 } },
        );
      current = dept?.parentId ? String(dept.parentId) : null;
    }
    return false;
  }
}
