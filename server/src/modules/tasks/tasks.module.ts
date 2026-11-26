import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthsModule } from '../auth/auth.module';
import { DepartmentsModule } from '../departments/departments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { Task, TaskSchema } from './schemas/task.schema';
import { TaskHistory, TaskHistorySchema } from './schemas/task-history.schema';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: TaskHistory.name, schema: TaskHistorySchema },
    ]),
    UsersModule,
    DepartmentsModule,
    NotificationsModule,
    forwardRef(() => AuthsModule),
    // PermissionsGuard cần RolesService.
    forwardRef(() => RolesModule),
  ],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
