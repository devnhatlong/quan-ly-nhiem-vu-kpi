import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsMongoId, IsOptional } from 'class-validator';

import { CurrentUser, Permissions } from '@/common/decorators';
import { Permission } from '@/common/enums/permission.enum';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import type { JwtPayloadUser } from '@/common/interfaces/jwt-payload-user.interface';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { SupervisionService } from './supervision.service';

export class SupervisionQueryDto {
  @ApiPropertyOptional({
    description: 'Đơn vị cần xem; bỏ trống = Ban đầu tiên quản lý được',
  })
  @IsOptional()
  @IsMongoId({ message: 'Đơn vị không hợp lệ.' })
  departmentId?: string;
}

export class SetDeputyAssistantsDto {
  @ApiProperty({
    type: [String],
    description: 'Id các trợ lý do Phó ban phụ trách',
  })
  @IsArray({ message: 'Danh sách trợ lý phải là mảng.' })
  @ArrayMaxSize(500)
  @IsMongoId({ each: true, message: 'Trợ lý không hợp lệ.' })
  assistantIds!: string[];
}

@ApiTags('Supervision (Phân công phụ trách)')
@ApiBearerAuth()
@UseGuards(JwtGuard, PermissionsGuard)
@Permissions(Permission.SUPERVISION_MANAGE)
@Controller('supervision')
export class SupervisionController {
  constructor(private readonly supervision: SupervisionService) {}

  @ApiOperation({
    summary: 'Trưởng ban, Phó ban, trợ lý của một Ban và phân công hiện tại',
  })
  @Get()
  overview(
    @CurrentUser() user: JwtPayloadUser,
    @Query() query: SupervisionQueryDto,
  ) {
    return this.supervision.overview(user, query.departmentId);
  }

  @ApiOperation({ summary: 'Đặt danh sách trợ lý do một Phó ban phụ trách' })
  @Put('deputies/:id/assistants')
  setDeputyAssistants(
    @CurrentUser() user: JwtPayloadUser,
    @Param('id') id: string,
    @Body() dto: SetDeputyAssistantsDto,
  ) {
    return this.supervision.setDeputyAssistants(user, id, dto.assistantIds);
  }
}
