import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DbModule } from './modules/db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { CrmModule } from './modules/crm/crm.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HrmsModule } from './modules/hrms/hrms.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { AiModule } from './modules/ai/ai.module';
import { AutomationModule } from './modules/automation/automation.module';
import { StorageModule } from './modules/storage/storage.module';
import { MailModule } from './modules/mail/mail.module';
import { TenantInterceptor } from './common/tenant.interceptor';

@Module({
  imports: [
    DbModule,
    AuthModule,
    CrmModule,
    ProjectsModule,
    FinanceModule,
    HrmsModule,
    MonitoringModule,
    AiModule,
    AutomationModule,
    StorageModule,
    MailModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule {}
