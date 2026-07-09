import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { Role } from '@vexor/types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('monitoring')
export class MonitoringController {
  constructor(private monitoringService: MonitoringService) {}

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.PROJECT_MANAGER)
  @Get()
  async getMonitors(@Request() req: any) {
    return this.monitoringService.getMonitors(req.user.organizationId);
  }

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN)
  @Post()
  async addMonitor(@Request() req: any, @Body() body: any) {
    return this.monitoringService.addMonitor(req.user.organizationId, body.name, body.url);
  }

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.PROJECT_MANAGER)
  @Post(':id/ping')
  async triggerPing(@Param('id') id: string) {
    return this.monitoringService.triggerManualPing(id);
  }
}
