import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { RoleCode } from '@/common/enums/role-code.enum';
import type { JwtPayloadUser } from '@/common/interfaces/jwt-payload-user.interface';
import { buildPaginatedResponse } from '@/common/utils/pagination.util';
import { User, UserDocument } from '@/modules/users/schemas/user.schema';
import {
  Department,
  DepartmentDocument,
} from '@/modules/departments/schemas/department.schema';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import {
  mimeTypeFor,
  parseClassification,
} from '@/modules/uploads/upload-file.utils';
import { Task, TaskAttachment, TaskDocument } from './schemas/task.schema';
import {
  TaskHistory,
  TaskHistoryDocument,
  type FieldChange,
} from './schemas/task-history.schema';
import {
  ApproveTaskDto,
  CancelTaskDto,
  CommentTaskDto,
  CreateAssignedTaskDto,
  ForwardTaskDto,
  PartDoneDto,
  ProgressTaskDto,
  ReportDoneDto,
  ReturnTaskDto,
  SelfReportDto,
  TaskListQueryDto,
  UpdateAssignedTaskDto,
} from './dto/task.dto';
import {
  BUSINESS_TIMEZONE,
  LABELS,
  type HistoryAction,
  type TaskStatus,
} from './task.constants';

type Person = {
  _id: Types.ObjectId;
  username: string;
  fullName?: string;
  rank?: string;
  position?: string;
  roleAssignments?: Array<{ roleCode?: string }>;
};

/** Người đang thao tác, đọc lại từ CSDL mỗi request (vai trò, Ban, phạm vi). */
type Actor = {
  id: Types.ObjectId;
  uid: string;
  name: string;
  departmentId: Types.ObjectId;
  isHead: boolean;
  isDeputy: boolean;
  isAssistant: boolean;
  /** Trợ lý do Phó ban này phụ trách (bảng Phân công phụ trách). */
  supervisedIds: Types.ObjectId[];
  supervisorId: Types.ObjectId | null;
};

/** Trường người trả kèm nhiệm vụ - chức vụ + mã vai trò để giao diện gắn nhãn. */
const PERSON_FIELDS =
  'username fullName rank position roleAssignments.roleCode';
const CLOSED: TaskStatus[] = ['COMPLETED', 'CANCELLED'];

function hasRole(
  assignments: Array<{ roleCode?: string }> | undefined,
  role: RoleCode,
): boolean {
  return (assignments ?? []).some((item) => item?.roleCode === role);
}

/** "Đại úy Hoàng Thu Trang" - cách gọi chụp vào lịch sử. */
export function personName(p?: Partial<Person> | null): string {
  if (!p) return '';
  const name = p.fullName?.trim() || p.username || '';
  return p.rank ? `${p.rank} ${name}` : name;
}

/**
 * Ghi chú lịch sử dạng từng dòng "Tên trường: giá trị" - giao diện tô đậm tên
 * trường. Dòng không có giá trị thì bỏ.
 */
function noteLines(...pairs: Array<[string, string | null | undefined]>) {
  return pairs
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => `${label}: ${value!.trim()}`)
    .join('\n');
}

function ymdLabel(ymd?: string | null) {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function sameId(
  a?: Types.ObjectId | string | null,
  b?: Types.ObjectId | string | null,
) {
  return Boolean(a && b && String(a) === String(b));
}

/** Năm theo giờ nghiệp vụ (Việt Nam) - mã nhiệm vụ đánh số lại mỗi năm. */
function businessYear(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
  }).format(date);
}

/**
 * Nhiệm vụ: giao từ trên xuống, tự khai gửi lên, duyệt 2 cấp, huỷ, lịch sử.
 * Nghiệp vụ theo docs/xac-nhan-nghiep-vu.md (G1–G4, S1–S9, C3, C8, K1, K2).
 */
@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(TaskHistory.name)
    private readonly historyModel: Model<TaskHistoryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
    private readonly notifications: NotificationsService,
  ) {}

  // ================================================================ đọc

  async list(jwt: JwtPayloadUser, query: TaskListQueryDto) {
    const actor = await this.loadActor(jwt);
    const view = query.view ?? 'mine';
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const and: Record<string, unknown>[] = [
      this.visibility(actor),
      this.viewFilter(actor, view),
    ];
    if (query.status) and.push({ status: query.status });
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      and.push({
        $or: [{ code: regex }, { content: regex }, { basis: regex }],
      });
    }
    const filter = { $and: and };

    const [rows, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate([
          { path: 'ownerId', select: PERSON_FIELDS },
          { path: 'handlerId', select: PERSON_FIELDS },
          { path: 'collaboratorIds', select: PERSON_FIELDS },
          { path: 'assignerId', select: PERSON_FIELDS },
          { path: 'createdById', select: PERSON_FIELDS },
          { path: 'review.deputyId', select: PERSON_FIELDS },
        ])
        .lean(),
      this.taskModel.countDocuments(filter),
    ]);

    return buildPaginatedResponse(rows, total, page, limit);
  }

  /** Số lượng cho các tab của trang danh sách. */
  async counts(jwt: JwtPayloadUser) {
    const actor = await this.loadActor(jwt);
    const base = this.visibility(actor);
    const count = (view: 'mine' | 'assigned' | 'review' | 'all') =>
      this.taskModel.countDocuments({
        $and: [base, this.viewFilter(actor, view)],
      });
    const [mine, assigned, review, all] = await Promise.all([
      count('mine'),
      actor.isHead || actor.isDeputy ? count('assigned') : 0,
      actor.isHead || actor.isDeputy ? count('review') : 0,
      actor.isHead || actor.isDeputy ? count('all') : 0,
    ]);
    return { message: 'OK', data: { mine, assigned, review, all } };
  }

  async detail(jwt: JwtPayloadUser, id: string) {
    const actor = await this.loadActor(jwt);
    const task = await this.requireVisible(actor, id);
    // Tính quyền TRƯỚC populate: sau populate các trường id thành object
    // người, so "có phải người lập / người giao" sẽ luôn sai.
    const can = this.capabilities(actor, task);
    await task.populate([
      { path: 'ownerId', select: PERSON_FIELDS },
      { path: 'handlerId', select: PERSON_FIELDS },
      { path: 'forwardedById', select: PERSON_FIELDS },
      { path: 'collaboratorIds', select: PERSON_FIELDS },
      { path: 'assignerId', select: PERSON_FIELDS },
      { path: 'createdById', select: PERSON_FIELDS },
      { path: 'review.deputyId', select: PERSON_FIELDS },
      { path: 'approvedById', select: PERSON_FIELDS },
      { path: 'confirmedById', select: PERSON_FIELDS },
    ]);
    const history = await this.historyModel
      .find({ taskId: task._id })
      .sort({ at: 1, _id: 1 })
      .lean();
    return {
      message: 'OK',
      data: {
        task: task.toObject(),
        history,
        can,
      },
    };
  }

  /**
   * Người được chọn làm chủ trì / phối hợp.
   * - Giao việc: Trưởng ban chọn mọi Phó ban, trợ lý trong Ban (G2, G3); Phó
   *   ban chỉ chọn trợ lý mình phụ trách (G4).
   * - Tự khai: phối hợp là ai trong Ban cũng được (trừ chính mình).
   */
  async people(
    jwt: JwtPayloadUser,
    purpose: 'assign' | 'self-report' | 'forward',
  ) {
    const actor = await this.loadActor(jwt);
    const members = await this.departmentMembers(actor.departmentId);
    let list: Person[];
    if (purpose === 'forward') {
      // Chuyển tiếp: chỉ trợ lý trong bảng Phân công phụ trách của mình.
      const scope = new Set(actor.supervisedIds.map(String));
      list = members.filter((m) => scope.has(String(m._id)));
    } else if (purpose === 'assign') {
      if (actor.isHead) {
        list = members.filter(
          (m) =>
            hasRole(m.roleAssignments, RoleCode.DEPUTY) ||
            hasRole(m.roleAssignments, RoleCode.ASSISTANT),
        );
      } else if (actor.isDeputy) {
        const scope = new Set(actor.supervisedIds.map(String));
        list = members.filter((m) => scope.has(String(m._id)));
      } else {
        list = [];
      }
    } else {
      list = members.filter(
        (m) =>
          !sameId(m._id, actor.id) &&
          (hasRole(m.roleAssignments, RoleCode.DEPUTY) ||
            hasRole(m.roleAssignments, RoleCode.ASSISTANT)),
      );
    }
    return {
      message: 'OK',
      data: list
        .map((m) => ({
          id: String(m._id),
          username: m.username,
          name: personName(m),
          role: hasRole(m.roleAssignments, RoleCode.DEPUTY)
            ? 'DEPUTY'
            : 'ASSISTANT',
          position: m.position?.trim() ?? '',
        }))
        // Phó ban lên trước, rồi trợ lý - theo thứ bậc trong Ban; cùng chức vụ
        // thì xếp theo tên.
        .sort((a, b) =>
          a.role === b.role
            ? a.name.localeCompare(b.name, 'vi')
            : a.role === 'DEPUTY'
              ? -1
              : 1,
        ),
    };
  }

  // ================================================== luồng giao xuống

  async createAssigned(jwt: JwtPayloadUser, dto: CreateAssignedTaskDto) {
    const actor = await this.loadActor(jwt);
    if (!actor.isHead && !actor.isDeputy) {
      throw new ForbiddenException(
        'Chỉ Trưởng ban, Phó ban được giao nhiệm vụ.',
      );
    }
    const { ownerId, collaboratorIds } = await this.assertAssignees(
      actor,
      dto.ownerId,
      dto.collaboratorIds ?? [],
    );
    this.assertDates(dto.startDate, dto.dueDate);
    const attachments = await this.resolveAttachments(
      actor,
      dto.attachmentIds ?? [],
      [],
    );

    const task = await this.taskModel.create({
      code: await this.nextCode(actor.departmentId),
      departmentId: actor.departmentId,
      source: 'ASSIGNED',
      content: dto.content,
      basis: dto.basis ?? '',
      type: dto.type,
      priority: dto.priority,
      createdById: actor.id,
      assignerId: actor.id,
      ownerId,
      handlerId: ownerId,
      collaboratorIds,
      startDate: dto.startDate ?? null,
      dueDate: dto.dueDate,
      assignedAt: new Date(),
      status: 'IN_PROGRESS',
      attachments,
    });
    await this.log(
      task,
      actor,
      'CREATED',
      noteLines(
        ['Chủ trì', await this.nameOf(ownerId)],
        [
          'Phối hợp',
          (await Promise.all(collaboratorIds.map((c) => this.nameOf(c)))).join(
            ', ',
          ),
        ],
      ),
    );

    await this.notifications.notify(
      [
        {
          userId: ownerId,
          kind: 'INCOMING',
          title: `Nhiệm vụ mới ${task.code}`,
          body: `${actor.name} giao bạn chủ trì: ${task.content}`,
          href: `/tasks/${String(task._id)}`,
        },
        ...collaboratorIds.map((id) => ({
          userId: id,
          kind: 'INFORM' as const,
          title: `Phối hợp nhiệm vụ ${task.code}`,
          body: `${actor.name} giao bạn phối hợp: ${task.content}`,
          href: `/tasks/${String(task._id)}`,
        })),
      ],
      { skipUserId: actor.id },
    );
    return {
      message: 'Đã giao nhiệm vụ.',
      data: { id: String(task._id), code: task.code },
    };
  }

  async updateAssigned(
    jwt: JwtPayloadUser,
    id: string,
    dto: UpdateAssignedTaskDto,
  ) {
    const actor = await this.loadActor(jwt);
    const task = await this.requireVisible(actor, id);
    if (!this.capabilities(actor, task).edit || task.source !== 'ASSIGNED') {
      throw new ForbiddenException('Bạn không sửa được nhiệm vụ này.');
    }
    const before = await this.snapshot(task);

    if (dto.ownerId !== undefined || dto.collaboratorIds !== undefined) {
      const people = await this.assertAssignees(
        actor,
        dto.ownerId ?? String(task.ownerId),
        dto.collaboratorIds ?? task.collaboratorIds.map(String),
      );
      if (!sameId(task.ownerId, people.ownerId)) {
        // Đổi chủ trì thì quyền xử lý chính về chủ trì mới, bỏ chuyển tiếp cũ.
        const previous = this.handlerOf(task);
        if (!sameId(previous, task.ownerId)) {
          task.formerHandlerIds = [...(task.formerHandlerIds ?? []), previous];
        }
        task.handlerId = people.ownerId;
        task.forwardedById = null;
      }
      task.ownerId = people.ownerId;
      task.collaboratorIds = people.collaboratorIds.filter(
        (c) => !sameId(c, this.handlerOf(task)),
      );
    }
    if (dto.content !== undefined) task.content = dto.content;
    if (dto.basis !== undefined) task.basis = dto.basis;
    if (dto.type !== undefined) task.type = dto.type;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.startDate !== undefined) task.startDate = dto.startDate || null;
    if (dto.dueDate !== undefined) task.dueDate = dto.dueDate;
    this.assertDates(task.startDate, task.dueDate);
    if (dto.attachmentIds !== undefined) {
      task.attachments = await this.resolveAttachments(
        actor,
        dto.attachmentIds,
        task.attachments,
      );
    }

    const changes = this.diff(before, await this.snapshot(task));
    if (!changes.length) return { message: 'Không có thay đổi.', data: { id } };
    await task.save();
    await this.log(task, actor, 'UPDATED', '', changes);
    return { message: 'Đã cập nhật nhiệm vụ.', data: { id } };
  }

  // =================================================== luồng tự khai

  async createSelfReport(jwt: JwtPayloadUser, dto: SelfReportDto) {
    const actor = await this.loadActor(jwt);
    this.assertCanSelfReport(actor);
    const collaboratorIds = await this.assertSelfReportCollaborators(
      actor,
      dto.collaboratorIds ?? [],
    );
    this.assertDates(dto.startDate, dto.dueDate);
    const attachments = await this.resolveAttachments(
      actor,
      dto.attachmentIds ?? [],
      [],
    );

    const task = await this.taskModel.create({
      departmentId: actor.departmentId,
      source: 'SELF_REPORTED',
      content: dto.content ?? '',
      basis: dto.basis ?? '',
      createdById: actor.id,
      ownerId: actor.id,
      handlerId: actor.id,
      collaboratorIds,
      startDate: dto.startDate ?? null,
      dueDate: dto.dueDate ?? null,
      status: 'DRAFT',
      reportedDone: dto.reportedDone ?? false,
      result: dto.result ?? '',
      attachments,
    });
    await this.log(task, actor, 'CREATED', 'Hình thức: Tự khai');

    if (dto.submit) return this.submitTask(actor, task);
    return { message: 'Đã lưu nháp.', data: { id: String(task._id) } };
  }

  async updateSelfReport(jwt: JwtPayloadUser, id: string, dto: SelfReportDto) {
    const actor = await this.loadActor(jwt);
    const task = await this.requireVisible(actor, id);
    if (
      task.source !== 'SELF_REPORTED' ||
      !this.capabilities(actor, task).edit
    ) {
      throw new ForbiddenException(
        'Chỉ sửa được bản tự khai của mình khi còn nháp hoặc bị trả lại.',
      );
    }
    const before = await this.snapshot(task);
    if (dto.content !== undefined) task.content = dto.content;
    if (dto.basis !== undefined) task.basis = dto.basis;
    if (dto.collaboratorIds !== undefined) {
      task.collaboratorIds = await this.assertSelfReportCollaborators(
        actor,
        dto.collaboratorIds,
      );
    }
    if (dto.startDate !== undefined) task.startDate = dto.startDate || null;
    if (dto.dueDate !== undefined) task.dueDate = dto.dueDate || null;
    if (dto.reportedDone !== undefined) task.reportedDone = dto.reportedDone;
    if (dto.result !== undefined) task.result = dto.result;
    if (dto.attachmentIds !== undefined) {
      task.attachments = await this.resolveAttachments(
        actor,
        dto.attachmentIds,
        task.attachments,
      );
    }
    this.assertDates(task.startDate, task.dueDate);

    const changes = this.diff(before, await this.snapshot(task));
    if (changes.length) {
      await task.save();
      await this.log(task, actor, 'UPDATED', '', changes);
    }
    if (dto.submit) return this.submitTask(actor, task);
    return {
      message: changes.length ? 'Đã lưu.' : 'Không có thay đổi.',
      data: { id },
    };
  }

  async submit(jwt: JwtPayloadUser, id: string) {
    const actor = await this.loadActor(jwt);
    const task = await this.requireVisible(actor, id);
    if (!this.capabilities(actor, task).submit) {
      throw new ForbiddenException('Bạn không gửi được bản này.');
    }
    return this.submitTask(actor, task);
  }

  /**
   * Gửi bản tự khai. Người duyệt bước 1 chốt theo bảng Phân công phụ trách
   * TẠI LÚC GỬI (S2): trợ lý có Phó ban phụ trách → Phó ban; còn lại → Trưởng ban.
   */
  private async submitTask(actor: Actor, task: TaskDocument) {
    if (!task.content.trim())
      throw new BadRequestException('Vui lòng nhập nội dung nhiệm vụ.');
    if (task.reportedDone && !task.result.trim()) {
      throw new BadRequestException('Việc đã làm xong cần ghi kết quả.');
    }
    if (!task.reportedDone && !task.dueDate) {
      throw new BadRequestException(
        'Việc đang thực hiện cần có hạn hoàn thành.',
      );
    }

    let deputyId: Types.ObjectId | null = null;
    if (!actor.isDeputy && actor.supervisorId) {
      const deputy = await this.userModel
        .findOne({
          _id: actor.supervisorId,
          isActive: true,
          departmentId: actor.departmentId,
          'roleAssignments.roleCode': RoleCode.DEPUTY,
        })
        .select('_id')
        .lean();
      deputyId = deputy?._id ?? null;
    }

    const from = task.status;
    const code = task.code ?? (await this.nextCode(actor.departmentId));
    const updated = await this.taskModel.findOneAndUpdate(
      { _id: task._id, status: { $in: ['DRAFT', 'RETURNED'] } },
      {
        $set: {
          code,
          status: 'PENDING_REVIEW',
          review: {
            kind: 'SUBMISSION',
            stage: deputyId ? 'DEPUTY' : 'HEAD',
            deputyId,
            since: new Date(),
          },
          proposal: null,
        },
      },
      { new: true },
    );
    if (!updated)
      throw new ConflictException(
        'Bản này vừa được người khác xử lý - tải lại trang.',
      );

    const target = deputyId
      ? `Phó ban ${await this.nameOf(deputyId)}`
      : 'Trưởng ban';
    await this.log(
      updated,
      actor,
      'SUBMITTED',
      noteLines([from === 'RETURNED' ? 'Gửi lại tới' : 'Gửi tới', target]),
    );
    await this.notifyReviewers(
      updated,
      actor,
      `${actor.name} gửi bản tự khai ${code}`,
    );
    return {
      message: `Đã gửi lên ${target}.`,
      data: { id: String(updated._id), code },
    };
  }

  // ======================================================== duyệt

  async approve(jwt: JwtPayloadUser, id: string, dto: ApproveTaskDto) {
    const actor = await this.loadActor(jwt);
    const task = await this.requireVisible(actor, id);
    const can = this.capabilities(actor, task);
    if (!can.review || !task.review) {
      throw new ForbiddenException(
        'Bạn không duyệt được bản này ở bước hiện tại.',
      );
    }
    if (task.review.kind === 'COMPLETION') {
      return this.confirmCompletion(actor, task, dto);
    }

    // ---- bước 1: Phó ban duyệt, đề xuất loại / mức độ, chuyển Trưởng ban
    if (task.review.stage === 'DEPUTY') {
      if (!dto.type || !dto.priority) {
        throw new BadRequestException(
          'Vui lòng chọn loại nhiệm vụ và mức độ ưu tiên.',
        );
      }
      if (task.reportedDone && !dto.evaluation) {
        throw new BadRequestException(
          'Việc đã làm xong cần đề xuất mức đánh giá.',
        );
      }
      const updated = await this.taskModel.findOneAndUpdate(
        { _id: task._id, status: 'PENDING_REVIEW', 'review.stage': 'DEPUTY' },
        {
          $set: {
            'review.stage': 'HEAD',
            'review.since': new Date(),
            proposal: {
              type: dto.type,
              priority: dto.priority,
              evaluation: task.reportedDone ? dto.evaluation : null,
              byId: actor.id,
              at: new Date(),
            },
          },
        },
        { new: true },
      );
      if (!updated)
        throw new ConflictException(
          'Bản này vừa được người khác xử lý - tải lại trang.',
        );
      await this.log(
        updated,
        actor,
        'APPROVED_STEP',
        this.proposalNote(dto, task.reportedDone, dto.note),
      );
      await this.notifyReviewers(
        updated,
        actor,
        `${actor.name} đã duyệt bước 1 bản ${updated.code}`,
      );
      return { message: 'Đã duyệt, chuyển Trưởng ban chốt.', data: { id } };
    }

    // ---- bước 2: Trưởng ban chốt
    const type = dto.type ?? task.proposal?.type;
    const priority = dto.priority ?? task.proposal?.priority;
    const evaluation = dto.evaluation ?? task.proposal?.evaluation ?? null;
    if (!type || !priority) {
      throw new BadRequestException(
        'Vui lòng chọn loại nhiệm vụ và mức độ ưu tiên.',
      );
    }
    if (task.reportedDone && !evaluation) {
      throw new BadRequestException('Việc đã làm xong cần chọn mức đánh giá.');
    }
    const now = new Date();
    const done = task.reportedDone;
    const updated = await this.taskModel.findOneAndUpdate(
      { _id: task._id, status: 'PENDING_REVIEW', 'review.stage': 'HEAD' },
      {
        $set: {
          type,
          priority,
          status: done ? 'COMPLETED' : 'IN_PROGRESS',
          review: null,
          lastReturn: null,
          approvedById: actor.id,
          assignedAt: now,
          ...(done
            ? {
                progress: 100,
                completedAt: now,
                confirmedById: actor.id,
                evaluation,
              }
            : {}),
        },
      },
      { new: true },
    );
    if (!updated)
      throw new ConflictException(
        'Bản này vừa được người khác xử lý - tải lại trang.',
      );

    const changes: FieldChange[] = [];
    if (task.proposal?.type && task.proposal.type !== type) {
      changes.push({
        field: 'type',
        from: LABELS.type[task.proposal.type],
        to: LABELS.type[type],
      });
    }
    if (task.proposal?.priority && task.proposal.priority !== priority) {
      changes.push({
        field: 'priority',
        from: LABELS.priority[task.proposal.priority],
        to: LABELS.priority[priority],
      });
    }
    if (
      done &&
      task.proposal?.evaluation &&
      evaluation &&
      task.proposal.evaluation !== evaluation
    ) {
      changes.push({
        field: 'evaluation',
        from: LABELS.evaluation[task.proposal.evaluation],
        to: LABELS.evaluation[evaluation],
      });
    }
    await this.log(
      updated,
      actor,
      'APPROVED',
      noteLines(
        ['Kết quả', done ? 'Đã hoàn thành' : 'Chuyển Đang thực hiện'],
        ['Đánh giá', done ? LABELS.evaluation[evaluation!] : ''],
        ['Loại', LABELS.type[type]],
        ['Ưu tiên', LABELS.priority[priority]],
        ['Ý kiến', dto.note],
      ),
      changes,
    );
    await this.notifications.notify(
      [task.createdById, task.proposal?.byId].map((userId) => ({
        userId,
        kind: 'APPROVED' as const,
        title: `Đã chốt ${updated.code}`,
        body: done
          ? `Trưởng ban xác nhận hoàn thành: ${updated.content}`
          : `Trưởng ban đã duyệt: ${updated.content}`,
        href: `/tasks/${id}`,
      })),
      { skipUserId: actor.id },
    );
    return {
      message: done
        ? 'Đã chốt hoàn thành.'
        : 'Đã chốt, nhiệm vụ chuyển Đang thực hiện.',
      data: { id },
    };
  }

  /**
   * Trả lại (S7): Phó ban trả về người lập; Trưởng ban chọn trả về Phó ban
   * (bước trước) hoặc về người lập (ban đầu). Luôn bắt buộc lý do.
   */
  async returnTask(jwt: JwtPayloadUser, id: string, dto: ReturnTaskDto) {
    const actor = await this.loadActor(jwt);
    const task = await this.requireVisible(actor, id);
    const can = this.capabilities(actor, task);
    const to = dto.to ?? 'START';
    if (!can.review || !can.returnTargets.includes(to)) {
      throw new ForbiddenException(
        'Bạn không trả lại được bản này theo cách đó.',
      );
    }
    const stage = task.review!.stage;
    const completion = task.review!.kind === 'COMPLETION';
    const event = { byId: actor.id, at: new Date(), reason: dto.reason };

    const update =
      to === 'PREVIOUS'
        ? {
            $set: {
              'review.stage': 'DEPUTY',
              'review.since': new Date(),
              proposal: null,
              lastReturn: event,
            },
          }
        : {
            $set: {
              // Báo cáo hoàn thành bị trả thì quay về Đang thực hiện (C2);
              // bản tự khai bị trả thì về người lập sửa.
              status: completion ? 'IN_PROGRESS' : 'RETURNED',
              review: null,
              proposal: null,
              lastReturn: event,
            },
          };
    const updated = await this.taskModel.findOneAndUpdate(
      { _id: task._id, status: task.status, 'review.stage': stage },
      update,
      { new: true },
    );
    if (!updated)
      throw new ConflictException(
        'Bản này vừa được người khác xử lý - tải lại trang.',
      );

    const where =
      to === 'PREVIOUS'
        ? `về Phó ban ${await this.nameOf(task.review!.deputyId)}`
        : completion
          ? `về người xử lý chính ${await this.nameOf(this.handlerOf(task))}`
          : `về người lập ${await this.nameOf(task.createdById)}`;
    await this.log(
      updated,
      actor,
      'RETURNED',
      noteLines(['Trả về', where.replace(/^về /, '')], ['Lý do', dto.reason]),
    );
    const recipients: Array<Types.ObjectId | null | undefined> =
      to === 'PREVIOUS'
        ? [task.review!.deputyId]
        : completion
          ? [this.handlerOf(task), task.ownerId, task.proposal?.byId]
          : [task.createdById, task.proposal?.byId];
    await this.notifications.notify(
      recipients.map((userId) => ({
        userId,
        kind: 'RETURNED' as const,
        title: `Bị trả lại ${updated.code}`,
        body: `${actor.name} trả lại.\nLý do: ${dto.reason}`,
        href: `/tasks/${id}`,
      })),
      { skipUserId: actor.id },
    );
    return { message: `Đã trả ${where}.`, data: { id } };
  }

  async cancel(jwt: JwtPayloadUser, id: string, dto: CancelTaskDto) {
    const actor = await this.loadActor(jwt);
    const task = await this.requireVisible(actor, id);
    if (!this.capabilities(actor, task).cancel) {
      throw new ForbiddenException('Bạn không huỷ được nhiệm vụ này.');
    }
    const from = task.status;
    const updated = await this.taskModel.findOneAndUpdate(
      { _id: task._id, status: from },
      {
        $set: {
          status: 'CANCELLED',
          review: null,
          cancellation: { byId: actor.id, at: new Date(), reason: dto.reason },
        },
      },
      { new: true },
    );
    if (!updated)
      throw new ConflictException(
        'Nhiệm vụ vừa được người khác xử lý - tải lại trang.',
      );
    await this.log(updated, actor, 'CANCELLED', `Lý do: ${dto.reason}`, [
      {
        field: 'status',
        from: LABELS.status[from],
        to: LABELS.status.CANCELLED,
      },
    ]);
    if (from !== 'DRAFT') {
      await this.notifications.notify(
        [
          task.ownerId,
          task.handlerId,
          ...task.collaboratorIds,
          task.assignerId,
          task.review?.deputyId,
        ].map((userId) => ({
          userId,
          kind: 'INFORM' as const,
          title: `Đã huỷ ${updated.code ?? 'nhiệm vụ'}`,
          body: `${actor.name} huỷ nhiệm vụ.\nLý do: ${dto.reason}`,
          href: `/tasks/${id}`,
        })),
        { skipUserId: actor.id },
      );
    }
    return { message: 'Đã huỷ nhiệm vụ.', data: { id } };
  }

  // ============================================ xử lý, tiến độ, hoàn thành

  /**
   * Chủ trì là Phó ban chuyển tiếp cho một trợ lý mình phụ trách làm người xử
   * lý chính. Chuyển lại cho người khác được; chủ trì vẫn xem, cho ý kiến,
   * thu hồi được.
   */
  async forward(jwt: JwtPayloadUser, id: string, dto: ForwardTaskDto) {
    const actor = await this.loadActor(jwt);
    const task = await this.requireVisible(actor, id);
    if (!this.capabilities(actor, task).forward) {
      throw new ForbiddenException('Bạn không chuyển tiếp được nhiệm vụ này.');
    }
    if (!actor.supervisedIds.some((s) => sameId(s, dto.handlerId))) {
      throw new BadRequestException(
        'Chỉ chuyển tiếp cho trợ lý mình phụ trách.',
      );
    }
    const previous = this.handlerOf(task);
    if (sameId(previous, dto.handlerId)) {
      throw new BadRequestException('Người này đang là người xử lý chính.');
    }
    const handlerId = new Types.ObjectId(dto.handlerId);

    // Phối hợp thêm: chỉ trợ lý mình phụ trách. Giữ người phối hợp cấp trên đã
    // giao; người xử lý chính thì không đồng thời là phối hợp.
    const added = [...new Set(dto.collaboratorIds ?? [])].filter(
      (c) => c !== dto.handlerId,
    );
    if (added.some((c) => !actor.supervisedIds.some((s) => sameId(s, c)))) {
      throw new BadRequestException(
        'Người phối hợp phải là trợ lý mình phụ trách.',
      );
    }
    const existing = task.collaboratorIds.map(String);
    const fresh = added.filter((c) => !existing.includes(c));
    const collaboratorIds = [...existing, ...fresh]
      .filter((c) => c !== dto.handlerId)
      .map((c) => new Types.ObjectId(c));

    const updated = await this.taskModel.findOneAndUpdate(
      {
        _id: task._id,
        status: 'IN_PROGRESS',
        ownerId: actor.id,
        updatedAt: task.updatedAt,
        ...this.handlerIs(previous),
      },
      {
        $set: { handlerId, forwardedById: actor.id, collaboratorIds },
        ...(sameId(previous, task.ownerId)
          ? {}
          : { $addToSet: { formerHandlerIds: previous } }),
      },
      { new: true },
    );
    if (!updated)
      throw new ConflictException(
        'Nhiệm vụ vừa được người khác xử lý - tải lại trang.',
      );

    const name = await this.nameOf(handlerId);
    const freshNames = await Promise.all(
      fresh.map((c) => this.nameOf(new Types.ObjectId(c))),
    );
    const replaced = !sameId(previous, task.ownerId);
    await this.log(
      updated,
      actor,
      'FORWARDED',
      noteLines(
        ['Người xử lý chính', name],
        ['Thay', replaced ? await this.nameOf(previous) : ''],
        ['Phối hợp thêm', freshNames.join(', ')],
        ['Chỉ đạo', dto.note],
      ),
    );
    await this.notifications.notify(
      [
        {
          userId: handlerId,
          kind: 'INCOMING' as const,
          title: `Nhiệm vụ chuyển tiếp ${updated.code}`,
          body: `${actor.name} chuyển bạn xử lý chính: ${updated.content}${dto.note ? `\n${dto.note}` : ''}`,
          href: `/tasks/${id}`,
        },
        ...fresh.map((c) => ({
          userId: c,
          kind: 'INFORM' as const,
          title: `Phối hợp nhiệm vụ ${updated.code}`,
          body: `${actor.name} giao bạn phối hợp với ${name}: ${updated.content}`,
          href: `/tasks/${id}`,
        })),
        ...(replaced
          ? [
              {
                userId: previous,
                kind: 'INFORM' as const,
                title: `Đổi người xử lý ${updated.code}`,
                body: `${actor.name} chuyển nhiệm vụ cho ${name} xử lý.`,
                href: `/tasks/${id}`,
              },
            ]
          : []),
      ],
      { skipUserId: actor.id },
    );
    return { message: `Đã chuyển tiếp cho ${name}.`, data: { id } };
  }

  /** Chủ trì lấy lại quyền xử lý chính. */
  async recall(jwt: JwtPayloadUser, id: string) {
    const actor = await this.loadActor(jwt);
    const task = await this.requireVisible(actor, id);
    if (!this.capabilities(actor, task).recall) {
      throw new ForbiddenException('Bạn không thu hồi được nhiệm vụ này.');
    }
    const previous = this.handlerOf(task);
    const updated = await this.taskModel.findOneAndUpdate(
      {
        _id: task._id,
        status: 'IN_PROGRESS',
        ownerId: actor.id,
        ...this.handlerIs(previous),
      },
      {
        $set: { handlerId: actor.id, forwardedById: null },
        $addToSet: { formerHandlerIds: previous },
      },
      { new: true },
    );
    if (!updated)
      throw new ConflictException(
        'Nhiệm vụ vừa được người khác xử lý - tải lại trang.',
      );
    const name = await this.nameOf(previous);
    await this.log(
      updated,
      actor,
      'RECALLED',
      noteLines(['Thu hồi từ', name], ['Người xử lý chính', actor.name]),
    );
    await this.notifications.notify(
      {
        userId: previous,
        kind: 'INFORM',
        title: `Thu hồi nhiệm vụ ${updated.code}`,
        body: `${actor.name} đã thu hồi, bạn không còn xử lý chính: ${updated.content}`,
        href: `/tasks/${id}`,
      },
      { skipUserId: actor.id },
    );
    return { message: `Đã thu hồi từ ${name}.`, data: { id } };
  }

  /** Chỉ người xử lý chính cập nhật tiến độ (C1, C4). */
  async updateProgress(jwt: JwtPayloadUser, id: string, dto: ProgressTaskDto) {
    const actor = await this.loadActor(jwt);
    const task = await this.requireVisible(actor, id);
    if (!this.capabilities(actor, task).progress) {
      throw new ForbiddenException(
        'Chỉ người xử lý chính cập nhật tiến độ khi nhiệm vụ đang thực hiện.',
      );
    }
    const attachments = await this.resolveAttachments(
      actor,
      dto.attachmentIds ?? [],
      [],
    );
    const from = task.progress;
    const updated = await this.taskModel.findOneAndUpdate(
      { _id: task._id, status: 'IN_PROGRESS', ...this.handlerIs(actor.id) },
      { $set: { progress: dto.progress } },
      { new: true },
    );
    if (!updated)
      throw new ConflictException(
        'Nhiệm vụ vừa được người khác xử lý - tải lại trang.',
      );
    await this.log(
      updated,
      actor,
      'PROGRESS',
      dto.note,
      from !== dto.progress
        ? [{ field: 'progress', from: `${from}%`, to: `${dto.progress}%` }]
        : [],
      attachments,
    );
    return { message: 'Đã cập nhật tiến độ.', data: { id } };
  }

  /**
   * Người xử lý chính báo cáo hoàn thành → Chờ xác nhận (C2, S8). Xác nhận 2
   * cấp: Phó ban (người chuyển tiếp, hoặc Phó ban phụ trách trợ lý xử lý) rồi
   * Trưởng ban chốt; không có Phó ban phù hợp thì Trưởng ban chốt luôn.
   */
  async reportDone(jwt: JwtPayloadUser, id: string, dto: ReportDoneDto) {
    const actor = await this.loadActor(jwt);
    const task = await this.requireVisible(actor, id);
    if (!this.capabilities(actor, task).report) {
      throw new ForbiddenException(
        'Chỉ người xử lý chính báo cáo hoàn thành khi nhiệm vụ đang thực hiện.',
      );
    }
    const resultAttachments = await this.resolveAttachments(
      actor,
      dto.attachmentIds ?? [],
      task.resultAttachments ?? [],
    );
    const deputyId = await this.completionDeputy(task, actor.id);
    const now = new Date();
    const updated = await this.taskModel.findOneAndUpdate(
      { _id: task._id, status: 'IN_PROGRESS', ...this.handlerIs(actor.id) },
      {
        $set: {
          status: 'PENDING_CONFIRMATION',
          progress: 100,
          result: dto.result,
          resultAttachments,
          reportedAt: now,
          review: {
            kind: 'COMPLETION',
            stage: deputyId ? 'DEPUTY' : 'HEAD',
            deputyId,
            since: now,
          },
          proposal: null,
        },
      },
      { new: true },
    );
    if (!updated)
      throw new ConflictException(
        'Nhiệm vụ vừa được người khác xử lý - tải lại trang.',
      );
    const target = deputyId
      ? `Phó ban ${await this.nameOf(deputyId)}`
      : 'Trưởng ban';
    await this.log(
      updated,
      actor,
      'REPORTED',
      noteLines(['Gửi xác nhận', target], ['Kết quả', dto.result]),
      task.progress !== 100
        ? [{ field: 'progress', from: `${task.progress}%`, to: '100%' }]
        : [],
      resultAttachments.filter(
        (a) => !(task.resultAttachments ?? []).some((o) => sameId(o.id, a.id)),
      ),
    );
    await this.notifyReviewers(
      updated,
      actor,
      `${actor.name} báo cáo hoàn thành ${updated.code}`,
    );
    return { message: `Đã báo cáo hoàn thành, gửi ${target}.`, data: { id } };
  }

  /** Xác nhận hoàn thành: Phó ban đề xuất mức đánh giá, Trưởng ban chốt. */
  private async confirmCompletion(
    actor: Actor,
    task: TaskDocument,
    dto: ApproveTaskDto,
  ) {
    const id = String(task._id);
    if (task.review!.stage === 'DEPUTY') {
      if (!dto.evaluation) {
        throw new BadRequestException('Vui lòng đề xuất mức đánh giá.');
      }
      const updated = await this.taskModel.findOneAndUpdate(
        {
          _id: task._id,
          status: 'PENDING_CONFIRMATION',
          'review.stage': 'DEPUTY',
        },
        {
          $set: {
            'review.stage': 'HEAD',
            'review.since': new Date(),
            proposal: {
              type: null,
              priority: null,
              evaluation: dto.evaluation,
              byId: actor.id,
              at: new Date(),
            },
          },
        },
        { new: true },
      );
      if (!updated)
        throw new ConflictException(
          'Nhiệm vụ vừa được người khác xử lý - tải lại trang.',
        );
      await this.log(
        updated,
        actor,
        'APPROVED_STEP',
        noteLines(
          ['Chuyển tới', 'Trưởng ban chốt'],
          ['Đề xuất đánh giá', LABELS.evaluation[dto.evaluation]],
          ['Ý kiến', dto.note],
        ),
      );
      await this.notifyReviewers(
        updated,
        actor,
        `${actor.name} đã xác nhận bước 1 ${updated.code}`,
      );
      return { message: 'Đã xác nhận, chuyển Trưởng ban chốt.', data: { id } };
    }

    const evaluation = dto.evaluation ?? task.proposal?.evaluation ?? null;
    if (!evaluation) {
      throw new BadRequestException('Vui lòng chọn mức đánh giá.');
    }
    const now = new Date();
    const updated = await this.taskModel.findOneAndUpdate(
      { _id: task._id, status: 'PENDING_CONFIRMATION', 'review.stage': 'HEAD' },
      {
        $set: {
          status: 'COMPLETED',
          review: null,
          lastReturn: null,
          progress: 100,
          completedAt: now,
          confirmedById: actor.id,
          evaluation,
        },
      },
      { new: true },
    );
    if (!updated)
      throw new ConflictException(
        'Nhiệm vụ vừa được người khác xử lý - tải lại trang.',
      );
    const proposed = task.proposal?.evaluation;
    await this.log(
      updated,
      actor,
      'APPROVED',
      noteLines(
        ['Kết quả', 'Xác nhận hoàn thành'],
        ['Đánh giá', LABELS.evaluation[evaluation]],
        ['Ý kiến', dto.note],
      ),
      proposed && proposed !== evaluation
        ? [
            {
              field: 'evaluation',
              from: LABELS.evaluation[proposed],
              to: LABELS.evaluation[evaluation],
            },
          ]
        : [],
    );
    await this.notifications.notify(
      [
        this.handlerOf(task),
        task.ownerId,
        task.assignerId,
        task.proposal?.byId,
      ].map((userId) => ({
        userId,
        kind: 'APPROVED' as const,
        title: `Đã xác nhận hoàn thành ${updated.code}`,
        body: `${LABELS.evaluation[evaluation]}: ${updated.content}`,
        href: `/tasks/${id}`,
      })),
      { skipUserId: actor.id },
    );
    return { message: 'Đã xác nhận hoàn thành.', data: { id } };
  }

  /**
   * Ý kiến trên dòng thời gian - mọi người xem được nhiệm vụ đều cho ý kiến
   * (người phối hợp chỉ có quyền này, không cập nhật tiến độ).
   */
  async comment(jwt: JwtPayloadUser, id: string, dto: CommentTaskDto) {
    const actor = await this.loadActor(jwt);
    const task = await this.requireVisible(actor, id);
    if (!this.capabilities(actor, task).comment) {
      throw new ForbiddenException('Không cho ý kiến được ở trạng thái này.');
    }
    const attachments = await this.resolveAttachments(
      actor,
      dto.attachmentIds ?? [],
      [],
    );
    await this.log(task, actor, 'COMMENT', dto.note, [], attachments);
    // Đụng updatedAt để nhiệm vụ nổi lên đầu danh sách.
    await this.taskModel.updateOne(
      { _id: task._id },
      { $currentDate: { updatedAt: true } },
    );
    const body =
      dto.note.length > 200 ? `${dto.note.slice(0, 200)}…` : dto.note;
    await this.notifications.notify(
      [
        this.handlerOf(task),
        task.ownerId,
        task.assignerId,
        task.forwardedById,
        task.createdById,
        ...task.collaboratorIds,
      ].map((userId) => ({
        userId,
        kind: 'COMMENT' as const,
        title: `Ý kiến mới ${task.code ?? ''}`.trim(),
        body: `${actor.name}: ${body}`,
        href: `/tasks/${id}`,
      })),
      { skipUserId: actor.id },
    );
    return { message: 'Đã gửi ý kiến.', data: { id } };
  }

  /**
   * Người phối hợp đánh dấu xong / bỏ đánh dấu phần việc của mình. Chỉ là dấu
   * riêng: nhiệm vụ vẫn Đang thực hiện cho tới khi người xử lý chính báo cáo.
   */
  async markPart(
    jwt: JwtPayloadUser,
    id: string,
    done: boolean,
    dto: PartDoneDto | null,
  ) {
    const actor = await this.loadActor(jwt);
    const task = await this.requireVisible(actor, id);
    const can = this.capabilities(actor, task);
    if (done ? !can.partDone : !can.partUndo) {
      throw new ForbiddenException(
        done
          ? 'Chỉ người phối hợp đánh dấu xong phần việc khi nhiệm vụ đang thực hiện.'
          : 'Bạn chưa đánh dấu xong phần việc nào để bỏ.',
      );
    }
    const attachments = dto
      ? await this.resolveAttachments(actor, dto.attachmentIds ?? [], [])
      : [];
    const note = dto?.note ?? '';
    const updated = await this.taskModel.findOneAndUpdate(
      {
        _id: task._id,
        status: 'IN_PROGRESS',
        collaboratorIds: actor.id,
        'collaboratorDone.userId': done ? { $ne: actor.id } : actor.id,
      },
      done
        ? {
            $push: {
              collaboratorDone: { userId: actor.id, at: new Date(), note },
            },
          }
        : { $pull: { collaboratorDone: { userId: actor.id } } },
      { new: true },
    );
    if (!updated)
      throw new ConflictException(
        'Nhiệm vụ vừa được người khác xử lý - tải lại trang.',
      );
    await this.log(
      updated,
      actor,
      done ? 'PART_DONE' : 'PART_UNDONE',
      noteLines(['Kết quả phần việc', note]),
      [],
      attachments,
    );
    await this.notifications.notify(
      [this.handlerOf(task), task.ownerId].map((userId) => ({
        userId,
        kind: 'INFORM' as const,
        title: done
          ? `Phối hợp đã xong phần việc ${task.code}`
          : `Phối hợp bỏ đánh dấu xong ${task.code}`,
        body: `${actor.name}${note ? `: ${note}` : ''}`,
        href: `/tasks/${id}`,
      })),
      { skipUserId: actor.id },
    );
    return {
      message: done
        ? 'Đã đánh dấu xong phần việc của bạn.'
        : 'Đã bỏ đánh dấu xong.',
      data: { id },
    };
  }

  /** Người xử lý chính hiện tại; dữ liệu cũ chưa có handlerId thì là chủ trì. */
  private handlerOf(task: TaskDocument): Types.ObjectId {
    return task.handlerId ?? task.ownerId;
  }

  /** Điều kiện "người xử lý chính là X" cho các lệnh cập nhật có điều kiện. */
  private handlerIs(userId: Types.ObjectId) {
    return {
      $or: [{ handlerId: userId }, { handlerId: null, ownerId: userId }],
    };
  }

  /** Phó ban xác nhận bước 1 cho báo cáo hoàn thành (S8). null = Trưởng ban chốt luôn. */
  private async completionDeputy(
    task: TaskDocument,
    handlerId: Types.ObjectId,
  ): Promise<Types.ObjectId | null> {
    let candidate: Types.ObjectId | null = null;
    if (task.forwardedById && !sameId(task.forwardedById, handlerId)) {
      candidate = task.forwardedById;
    } else {
      const handler = await this.userModel
        .findById(handlerId)
        .select('supervisorId roleAssignments')
        .lean();
      if (
        handler &&
        !hasRole(handler.roleAssignments, RoleCode.DEPUTY) &&
        handler.supervisorId
      ) {
        candidate = handler.supervisorId;
      }
    }
    if (!candidate || sameId(candidate, handlerId)) return null;
    const deputy = await this.userModel
      .findOne({
        _id: candidate,
        isActive: true,
        departmentId: task.departmentId,
        'roleAssignments.roleCode': RoleCode.DEPUTY,
      })
      .select('_id')
      .lean();
    return deputy?._id ?? null;
  }

  // ======================================================= quyền

  /** Những việc người này được làm với nhiệm vụ - server kiểm và trả về cho client. */
  private capabilities(actor: Actor, task: TaskDocument) {
    const mineCreated = sameId(task.createdById, actor.id);
    const open = !CLOSED.includes(task.status);
    const self = task.source === 'SELF_REPORTED';

    const editable = self
      ? mineCreated && (task.status === 'DRAFT' || task.status === 'RETURNED')
      : task.status === 'IN_PROGRESS' &&
        (sameId(task.assignerId, actor.id) || actor.isHead);

    const handler = this.handlerOf(task);
    const isHandler = sameId(handler, actor.id);
    const inReview =
      (task.status === 'PENDING_REVIEW' ||
        task.status === 'PENDING_CONFIRMATION') &&
      task.review;

    let review = false;
    let returnTargets: Array<'PREVIOUS' | 'START'> = [];
    if (inReview && task.review) {
      if (task.review.stage === 'DEPUTY') {
        review = actor.isDeputy && sameId(task.review.deputyId, actor.id);
        returnTargets = review ? ['START'] : [];
      } else {
        // Không ai tự duyệt bản mình lập, không ai tự xác nhận việc mình xử
        // lý (C3).
        review =
          actor.isHead &&
          (task.review.kind === 'COMPLETION' ? !isHandler : !mineCreated);
        returnTargets = review
          ? task.review.deputyId
            ? ['PREVIOUS', 'START']
            : ['START']
          : [];
      }
    }

    // C8: người giao huỷ việc mình giao; Trưởng ban huỷ mọi việc; người lập rút
    // lại bản tự khai khi chưa ai duyệt.
    const untouched =
      task.status === 'DRAFT' ||
      task.status === 'RETURNED' ||
      (task.status === 'PENDING_REVIEW' && !task.proposal);
    const cancel =
      open &&
      (actor.isHead ||
        (!self && sameId(task.assignerId, actor.id)) ||
        (self && mineCreated && untouched));

    const running = task.status === 'IN_PROGRESS';
    const owner = sameId(task.ownerId, actor.id);
    const collaborator = task.collaboratorIds.some((c) => sameId(c, actor.id));
    const partDone = (task.collaboratorDone ?? []).some((d) =>
      sameId(d.userId, actor.id),
    );
    return {
      edit: editable,
      // Chỉ người xử lý chính ở luồng hiện tại cập nhật tiến độ / báo xong.
      progress: running && isHandler,
      report: running && isHandler,
      // Chủ trì là Phó ban chuyển tiếp cho trợ lý mình phụ trách.
      // Đang chuyển cho trợ lý thì phải thu hồi trước rồi mới chuyển người khác.
      forward:
        running &&
        owner &&
        actor.isDeputy &&
        actor.supervisedIds.length > 0 &&
        sameId(handler, task.ownerId),
      recall: running && owner && !sameId(handler, task.ownerId),
      comment: task.status !== 'DRAFT' && task.status !== 'CANCELLED',
      // Người phối hợp đánh dấu xong phần việc của mình (không đóng nhiệm vụ).
      partDone: running && collaborator && !partDone,
      partUndo: running && collaborator && partDone,
      submit:
        self &&
        mineCreated &&
        (task.status === 'DRAFT' || task.status === 'RETURNED'),
      review,
      returnTargets,
      cancel,
    };
  }

  private async loadActor(jwt: JwtPayloadUser): Promise<Actor> {
    const user = await this.userModel
      .findById(jwt.uid)
      .select(
        'username fullName rank departmentId roleAssignments supervisorId isActive',
      )
      .lean();
    if (!user?.isActive)
      throw new ForbiddenException('Tài khoản không hợp lệ.');
    const isHead = hasRole(user.roleAssignments, RoleCode.HEAD);
    const isDeputy = hasRole(user.roleAssignments, RoleCode.DEPUTY);
    const isAssistant = hasRole(user.roleAssignments, RoleCode.ASSISTANT);
    if (!isHead && !isDeputy && !isAssistant) {
      throw new ForbiddenException(
        'Tài khoản không tham gia nghiệp vụ nhiệm vụ.',
      );
    }
    if (!user.departmentId) {
      throw new ForbiddenException(
        'Tài khoản chưa thuộc Ban nào - liên hệ quản trị hệ thống.',
      );
    }
    const supervisedIds = isDeputy
      ? (
          await this.userModel
            .find({
              supervisorId: user._id,
              departmentId: user.departmentId,
              isActive: true,
              'roleAssignments.roleCode': RoleCode.ASSISTANT,
            })
            .select('_id')
            .lean()
        ).map((u) => u._id)
      : [];
    return {
      id: user._id,
      uid: String(user._id),
      name: personName(user),
      departmentId: user.departmentId,
      isHead,
      isDeputy,
      isAssistant,
      supervisedIds,
      supervisorId: user.supervisorId ?? null,
    };
  }

  /**
   * Phạm vi xem (§13): Trưởng ban - cả Ban; Phó ban - việc của mình và của
   * trợ lý mình phụ trách, việc mình giao, bản đang chờ mình duyệt; trợ lý -
   * việc mình chủ trì / phối hợp / lập. Nháp chỉ người lập thấy.
   */
  private visibility(actor: Actor): Record<string, unknown> {
    const notOthersDraft = {
      $or: [{ status: { $ne: 'DRAFT' } }, { createdById: actor.id }],
    };
    if (actor.isHead)
      return { departmentId: actor.departmentId, ...notOthersDraft };
    const people = actor.isDeputy
      ? [actor.id, ...actor.supervisedIds]
      : [actor.id];
    const reach: Record<string, unknown>[] = [
      { ownerId: { $in: people } },
      { handlerId: { $in: people } },
      { formerHandlerIds: { $in: people } },
      { collaboratorIds: { $in: people } },
      { createdById: actor.id },
    ];
    if (actor.isDeputy) {
      reach.push(
        { assignerId: actor.id },
        { 'review.deputyId': actor.id },
        { 'proposal.byId': actor.id },
      );
    }
    return {
      $and: [
        { departmentId: actor.departmentId },
        notOthersDraft,
        { $or: reach },
      ],
    };
  }

  private viewFilter(
    actor: Actor,
    view: 'mine' | 'assigned' | 'review' | 'all',
  ): Record<string, unknown> {
    switch (view) {
      case 'assigned':
        return { assignerId: actor.id };
      case 'review': {
        const or: Record<string, unknown>[] = [];
        if (actor.isDeputy)
          or.push({ 'review.stage': 'DEPUTY', 'review.deputyId': actor.id });
        if (actor.isHead)
          or.push(
            {
              'review.kind': 'SUBMISSION',
              'review.stage': 'HEAD',
              createdById: { $ne: actor.id },
            },
            { 'review.kind': 'COMPLETION', 'review.stage': 'HEAD' },
          );
        if (!or.length) return { _id: null };
        return {
          status: { $in: ['PENDING_REVIEW', 'PENDING_CONFIRMATION'] },
          $or: or,
        };
      }
      case 'all':
        return actor.isHead || actor.isDeputy ? {} : { _id: null };
      default:
        return {
          $or: [
            { ownerId: actor.id },
            { handlerId: actor.id },
            { collaboratorIds: actor.id },
            { createdById: actor.id },
          ],
        };
    }
  }

  private async requireVisible(actor: Actor, id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Không tìm thấy nhiệm vụ.');
    const task = await this.taskModel.findOne({
      $and: [{ _id: new Types.ObjectId(id) }, this.visibility(actor)],
    });
    if (!task) throw new NotFoundException('Không tìm thấy nhiệm vụ.');
    return task;
  }

  private assertCanSelfReport(actor: Actor) {
    if (!actor.isAssistant && !actor.isDeputy) {
      throw new ForbiddenException('Chỉ trợ lý, Phó ban lập bản tự khai.');
    }
  }

  /** Chủ trì / phối hợp hợp lệ theo vai trò người giao (G2–G4, C3). */
  private async assertAssignees(
    actor: Actor,
    ownerId: string,
    collaboratorIds: string[],
  ) {
    let allowed: Set<string>;
    if (actor.isHead) {
      const members = await this.departmentMembers(actor.departmentId);
      allowed = new Set(
        members
          .filter(
            (m) =>
              hasRole(m.roleAssignments, RoleCode.DEPUTY) ||
              hasRole(m.roleAssignments, RoleCode.ASSISTANT),
          )
          .map((m) => String(m._id)),
      );
    } else {
      allowed = new Set(actor.supervisedIds.map(String));
    }
    if (!allowed.has(ownerId)) {
      throw new BadRequestException(
        actor.isHead
          ? 'Người chủ trì phải là Phó ban hoặc trợ lý đang hoạt động trong Ban.'
          : 'Phó ban chỉ giao cho trợ lý mình phụ trách.',
      );
    }
    const collaborators = [...new Set(collaboratorIds)].filter(
      (id) => id !== ownerId,
    );
    const outside = collaborators.filter((id) => !allowed.has(id));
    if (outside.length) {
      throw new BadRequestException(
        actor.isHead
          ? 'Người phối hợp phải là Phó ban hoặc trợ lý đang hoạt động trong Ban.'
          : 'Phó ban chỉ chọn người phối hợp trong số trợ lý mình phụ trách.',
      );
    }
    return {
      ownerId: new Types.ObjectId(ownerId),
      collaboratorIds: collaborators.map((id) => new Types.ObjectId(id)),
    };
  }

  private async assertSelfReportCollaborators(actor: Actor, ids: string[]) {
    const unique = [...new Set(ids)].filter((id) => id !== actor.uid);
    if (!unique.length) return [];
    const members = await this.departmentMembers(actor.departmentId);
    const allowed = new Set(
      members
        .filter(
          (m) =>
            hasRole(m.roleAssignments, RoleCode.DEPUTY) ||
            hasRole(m.roleAssignments, RoleCode.ASSISTANT),
        )
        .map((m) => String(m._id)),
    );
    if (unique.some((id) => !allowed.has(id))) {
      throw new BadRequestException(
        'Người phối hợp phải là Phó ban hoặc trợ lý đang hoạt động trong Ban.',
      );
    }
    return unique.map((id) => new Types.ObjectId(id));
  }

  private assertDates(start?: string | null, due?: string | null) {
    if (start && due && start > due) {
      throw new BadRequestException(
        'Ngày bắt đầu không được sau hạn hoàn thành.',
      );
    }
  }

  // ============================================================ tiện ích

  private departmentMembers(departmentId: Types.ObjectId) {
    return this.userModel
      .find({ departmentId, isActive: true })
      .select('username fullName rank position roleAssignments')
      .lean<Person[]>();
  }

  private async nameOf(id?: Types.ObjectId | null) {
    if (!id) return '';
    return personName(
      await this.userModel.findById(id).select(PERSON_FIELDS).lean(),
    );
  }

  /** Mã `<mã Ban>-<năm>-<số thứ tự>`, đếm lại mỗi năm (K1). */
  private async nextCode(departmentId: Types.ObjectId) {
    const dept = await this.departmentModel
      .findById(departmentId)
      .select('code')
      .lean();
    const year = businessYear();
    const key = `${dept?.code ?? 'NV'}-${year}`;
    const counter = await this.taskModel.db
      .collection<{ _id: string; seq: number }>('task_counters')
      .findOneAndUpdate(
        { _id: key },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      );
    const seq = counter?.seq ?? 1;
    return `${key}-${String(seq).padStart(3, '0')}`;
  }

  /**
   * Tệp đính kèm: giữ tệp đã có; tệp mới phải do chính người này tải lên. Tên,
   * kích thước, độ mật đọc từ GridFS - không tin client.
   */
  private async resolveAttachments(
    actor: Actor,
    ids: string[],
    existing: TaskAttachment[],
  ) {
    const wanted = [...new Set(ids)];
    const kept = new Map(existing.map((a) => [String(a.id), a]));
    const fresh = wanted.filter((id) => !kept.has(id));
    const files = fresh.length
      ? await this.taskModel.db
          .collection('uploads.files')
          .find({ _id: { $in: fresh.map((id) => new Types.ObjectId(id)) } })
          .project<{
            _id: Types.ObjectId;
            filename: string;
            length: number;
            metadata?: {
              uploadedById?: Types.ObjectId;
              classification?: unknown;
            };
          }>({ filename: 1, length: 1, metadata: 1 })
          .toArray()
      : [];
    const byId = new Map(files.map((f) => [String(f._id), f]));
    return wanted.map((id) => {
      const old = kept.get(id);
      if (old) return old;
      const file = byId.get(id);
      if (!file || !sameId(file.metadata?.uploadedById, actor.id)) {
        throw new BadRequestException(
          'Tệp đính kèm không tồn tại hoặc không phải do bạn tải lên.',
        );
      }
      return {
        id: file._id,
        name: file.filename,
        size: file.length,
        mimeType: mimeTypeFor(file.filename),
        classification: parseClassification(file.metadata?.classification),
      };
    });
  }

  /** Giá trị hiển thị của các trường - để so trước / sau khi sửa. */
  private async snapshot(task: TaskDocument): Promise<Record<string, string>> {
    const ids = [task.ownerId, ...task.collaboratorIds];
    const people = await this.userModel
      .find({ _id: { $in: ids } })
      .select(PERSON_FIELDS)
      .lean();
    const name = new Map(people.map((p) => [String(p._id), personName(p)]));
    return {
      content: task.content,
      basis: task.basis,
      type: task.type ? LABELS.type[task.type] : '',
      priority: task.priority ? LABELS.priority[task.priority] : '',
      owner: name.get(String(task.ownerId)) ?? '',
      collaborators: task.collaboratorIds
        .map((id) => name.get(String(id)) ?? '')
        .join(', '),
      startDate: ymdLabel(task.startDate),
      dueDate: ymdLabel(task.dueDate),
      reportedDone:
        task.source === 'SELF_REPORTED'
          ? task.reportedDone
            ? 'Đã làm xong'
            : 'Đang thực hiện'
          : '',
      result: task.result,
      attachments: task.attachments.map((a) => a.name).join(', '),
    };
  }

  private diff(
    before: Record<string, string>,
    after: Record<string, string>,
  ): FieldChange[] {
    return Object.keys(after)
      .filter((field) => before[field] !== after[field])
      .map((field) => ({ field, from: before[field] ?? '', to: after[field] }));
  }

  private async log(
    task: TaskDocument,
    actor: Actor,
    action: HistoryAction,
    note = '',
    changes: FieldChange[] = [],
    attachments: TaskAttachment[] = [],
  ) {
    await this.historyModel.create({
      taskId: task._id,
      actorId: actor.id,
      actorName: actor.name,
      action,
      note,
      changes,
      attachments,
      at: new Date(),
    });
  }

  private proposalNote(dto: ApproveTaskDto, done: boolean, note?: string) {
    return noteLines(
      ['Chuyển tới', 'Trưởng ban chốt'],
      ['Đề xuất loại', LABELS.type[dto.type!]],
      ['Đề xuất ưu tiên', LABELS.priority[dto.priority!]],
      [
        'Đề xuất đánh giá',
        done && dto.evaluation ? LABELS.evaluation[dto.evaluation] : '',
      ],
      ['Ý kiến', note],
    );
  }

  /** Báo cho người đang phải duyệt bước hiện tại. */
  private async notifyReviewers(
    task: TaskDocument,
    actor: Actor,
    title: string,
  ) {
    let reviewers: Array<Types.ObjectId | null | undefined> = [];
    if (task.review?.stage === 'DEPUTY') {
      reviewers = [task.review.deputyId];
    } else {
      // Bản tự khai: Trưởng ban không tự duyệt bản mình lập. Báo cáo hoàn
      // thành: báo mọi Trưởng ban (Trưởng ban không xử lý chính).
      const exclude =
        task.review?.kind === 'COMPLETION' ? null : task.createdById;
      const heads = await this.userModel
        .find({
          departmentId: task.departmentId,
          isActive: true,
          'roleAssignments.roleCode': RoleCode.HEAD,
        })
        .select('_id')
        .lean();
      reviewers = heads.map((h) => h._id).filter((id) => !sameId(id, exclude));
    }
    await this.notifications.notify(
      reviewers.map((userId) => ({
        userId,
        kind: 'INCOMING' as const,
        title,
        body: task.content,
        href: `/tasks/${String(task._id)}`,
      })),
      { skipUserId: actor.id },
    );
  }
}
