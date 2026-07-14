import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CrmService } from './crm.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { Role } from '@vexor/types';
import { CreateLeadDto, UpdateLeadStatusDto, AssignLeadDto } from './dto/crm.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crm')
export class CrmController {
  constructor(private crmService: CrmService) {}

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.SALES_MANAGER, Role.SALES_EXECUTIVE, Role.DEVELOPER)
  @Get('leads')
  async getLeads(@Request() req: any) {
    return this.crmService.getLeads(req.user.organizationId, req.user);
  }

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.SALES_MANAGER, Role.SALES_EXECUTIVE, Role.DEVELOPER)
  @Post('leads')
  async createLead(@Request() req: any, @Body() body: CreateLeadDto) {
    return this.crmService.createLead(req.user.organizationId, req.user.id, body);
  }

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.SALES_MANAGER, Role.SALES_EXECUTIVE, Role.DEVELOPER)
  @Patch('leads/:id/status')
  async updateStatus(@Param('id') id: string, @Body() body: UpdateLeadStatusDto) {
    return this.crmService.updateLeadStatus(id, body.status, body.detail);
  }

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.SALES_MANAGER)
  @Patch('leads/:id/assign')
  async assignLead(@Param('id') id: string, @Body() body: AssignLeadDto) {
    return this.crmService.assignLead(id, body.assigneeId);
  }
}
