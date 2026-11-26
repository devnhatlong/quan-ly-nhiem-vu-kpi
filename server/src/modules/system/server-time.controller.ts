import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { BUSINESS_TIMEZONE } from '@/common/constants/time.constants';

/**
 * Nguồn giờ duy nhất cho giao diện: client đo độ lệch giữa giờ máy và
 * `serverTime`, rồi hiển thị theo `timezone` (múi giờ nghiệp vụ, không phải
 * múi giờ của máy chủ).
 */
@ApiTags('System')
@Controller('system')
export class ServerTimeController {
  @ApiOperation({ summary: 'Lấy giờ hiện tại của server + múi giờ nghiệp vụ' })
  @Get('server-time')
  getServerTime() {
    return {
      serverTime: new Date().toISOString(),
      timezone: BUSINESS_TIMEZONE,
    };
  }
}
