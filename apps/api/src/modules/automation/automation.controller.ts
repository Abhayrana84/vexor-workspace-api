import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { Role } from '@vexor/types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('automations')
export class AutomationController {
  constructor(private automationService: AutomationService) {}

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN)
  @Get()
  async getAutomations(@Request() req: any) {
    return this.automationService.getAutomations(req.user.organizationId);
  }

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN)
  @Post()
  async saveAutomation(@Request() req: any, @Body() body: any) {
    return this.automationService.saveAutomation(
      req.user.organizationId,
      body.name,
      body.trigger,
      body.actions,
    );
  }

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN)
  @Post(':id/simulate')
  async simulate(@Param('id') id: string) {
    return this.automationService.triggerSimulation(id);
  }
}
