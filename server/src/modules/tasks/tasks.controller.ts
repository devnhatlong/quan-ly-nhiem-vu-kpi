import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Permissions } from '@/common/decorators';
import { Permission } from '@/common/enums/permission.enum';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import type { JwtPayloadUser } from '@/common/interfaces/jwt-payload-user.interface';
import { JwtGuard } from '../auth/guards/jwt.guard';
import {
  ApproveTaskDto,
  CancelTaskDto,
  CreateAssignedTaskDto,
  ReturnTaskDto,
  SelfReportDto,
  TaskListQueryDto,
  UpdateAssignedTaskDto,
} from './dto/task.dto';
import { TasksService } from './tasks.service';

/**
 * Mã quyền chỉ là cổng ngoài; phạm vi thật (Ban nào, trợ lý nào, bước duyệt
 * nào) kiểm trong TasksService theo dữ liệu.
 */
@ApiTags('Tasks (Nhiệm vụ)')
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @ApiOperation({
    summary: 'Danh sách nhiệm vụ theo tab (mine / assigned / review / all)',
  })
  @Permissions(Permission.TASK_VIEW)
  @Get()
  list(@CurrentUser() user: JwtPayloadUser, @Query() query: TaskListQueryDto) {
    return this.tasks.list(user, query);
  }

  @ApiOperation({ summary: 'Số lượng từng tab' })
  @Permissions(Permission.TASK_VIEW)
  @Get('counts')
  counts(@CurrentUser() user: JwtPayloadUser) {
    return this.tasks.counts(user);
  }

  @ApiOperation({
    summary: 'Người chọn được làm chủ trì / phối hợp khi giao việc',
  })
  @Permissions(Permission.TASK_ASSIGN)
  @Get('people/assign')
  assignPeople(@CurrentUser() user: JwtPayloadUser) {
    return this.tasks.people(user, 'assign');
  }

  @ApiOperation({ summary: 'Người chọn được làm phối hợp khi tự khai' })
  @Permissions(Permission.TASK_SELF_REPORT)
  @Get('people/self-report')
  selfReportPeople(@CurrentUser() user: JwtPayloadUser) {
    return this.tasks.people(user, 'self-report');
  }

  @ApiOperation({ summary: 'Chi tiết + lịch sử + các thao tác được phép' })
  @Permissions(Permission.TASK_VIEW)
  @Get(':id')
  detail(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.tasks.detail(user, id);
  }

  @ApiOperation({ summary: 'Giao nhiệm vụ (Trưởng ban, Phó ban)' })
  @Permissions(Permission.TASK_ASSIGN)
  @Post()
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateAssignedTaskDto,
  ) {
    return this.tasks.createAssigned(user, dto);
  }

  @ApiOperation({ summary: 'Sửa nhiệm vụ được giao (người giao, Trưởng ban)' })
  @Permissions(Permission.TASK_ASSIGN)
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: UpdateAssignedTaskDto,
  ) {
    return this.tasks.updateAssigned(user, id, dto);
  }

  @ApiOperation({
    summary: 'Lập bản tự khai (nháp, hoặc gửi luôn khi submit=true)',
  })
  @Permissions(Permission.TASK_SELF_REPORT)
  @Post('self-reports')
  createSelfReport(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: SelfReportDto,
  ) {
    return this.tasks.createSelfReport(user, dto);
  }

  @ApiOperation({ summary: 'Sửa bản tự khai khi còn nháp / bị trả lại' })
  @Permissions(Permission.TASK_SELF_REPORT)
  @Patch('self-reports/:id')
  updateSelfReport(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: SelfReportDto,
  ) {
    return this.tasks.updateSelfReport(user, id, dto);
  }

  @ApiOperation({ summary: 'Gửi bản tự khai lên duyệt' })
  @Permissions(Permission.TASK_SELF_REPORT)
  @Post(':id/submit')
  submit(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.tasks.submit(user, id);
  }

  @ApiOperation({
    summary: 'Duyệt bước hiện tại (Phó ban bước 1, Trưởng ban chốt)',
  })
  @Permissions(Permission.TASK_REVIEW)
  @Post(':id/approve')
  approve(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: ApproveTaskDto,
  ) {
    return this.tasks.approve(user, id, dto);
  }

  @ApiOperation({
    summary: 'Trả lại kèm lý do (về bước trước hoặc về người lập)',
  })
  @Permissions(Permission.TASK_REVIEW)
  @Post(':id/return')
  returnTask(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: ReturnTaskDto,
  ) {
    return this.tasks.returnTask(user, id, dto);
  }

  @ApiOperation({ summary: 'Huỷ kèm lý do (không bao giờ xoá)' })
  @Permissions(Permission.TASK_VIEW)
  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: CancelTaskDto,
  ) {
    return this.tasks.cancel(user, id, dto);
  }
}
