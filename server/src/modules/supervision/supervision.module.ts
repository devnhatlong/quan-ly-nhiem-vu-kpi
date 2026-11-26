import { Module, forwardRef } from '@nestjs/common';

import { AuthsModule } from '../auth/auth.module';
import { DepartmentsModule } from '../departments/departments.module';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { SupervisionController } from './supervision.controller';
import { SupervisionService } from './supervision.service';

@Module({
  imports: [
    UsersModule,
    DepartmentsModule,
    forwardRef(() => AuthsModule),
    // PermissionsGuard cần RolesService.
    forwardRef(() => RolesModule),
  ],
  controllers: [SupervisionController],
  providers: [SupervisionService],
})
export class SupervisionModule {}
