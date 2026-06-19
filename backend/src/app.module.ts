import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { FirebaseModule } from './firebase/firebase.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { TaskLogsModule } from './task-logs/task-logs.module';
import { CommentsModule } from './comments/comments.module';
import { StorageModule } from './storage/storage.module';
import { DocumentsModule } from './documents/documents.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LeadsModule } from './leads/leads.module';
import { LeavesModule } from './leaves/leaves.module';
import { InvoicesModule } from './invoices/invoices.module';
import { TicketsModule } from './tickets/tickets.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { GanttModule } from './gantt/gantt.module';
import { AuditModule } from './audit/audit.module';
import { PayrollModule } from './payroll/payroll.module';
import { AttendanceModule } from './attendance/attendance.module';
import { QaModule } from './qa/qa.module';
import { EngineeringModule } from './engineering/engineering.module';
import { AppController } from './app.controller';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { TierGuard } from './auth/guards/tier.guard';
import { CapabilityGuard } from './auth/guards/capability.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FirebaseModule,
    MailModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    ProjectsModule,
    TasksModule,
    TaskLogsModule,
    CommentsModule,
    StorageModule,
    DocumentsModule,
    NotificationsModule,
    LeadsModule,
    LeavesModule,
    InvoicesModule,
    TicketsModule,
    AnalyticsModule,
    GanttModule,
    AuditModule,
    PayrollModule,
    AttendanceModule,
    QaModule,
    EngineeringModule,
  ],
  controllers: [AppController],
  providers: [
    // Global auth: every route requires a valid JWT unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global tier check: routes with @Tiers(...) are authorized here.
    { provide: APP_GUARD, useClass: TierGuard },
    // Global capability check: routes with @RequireCapability(...) are authorized here.
    { provide: APP_GUARD, useClass: CapabilityGuard },
  ],
})
export class AppModule {}
