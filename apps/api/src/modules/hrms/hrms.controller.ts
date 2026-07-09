import {
  Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request
} from '@nestjs/common';
import { HrmsService } from './hrms.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { Role } from '@vexor/types';
import {
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
  GrantPermissionsDto,
  RequestLeaveDto,
  UpdateLeaveStatusDto
} from './dto/hrms.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hrms')
export class HrmsController {
  constructor(private hrmsService: HrmsService) {}

  // ── People directory (Founder, HR, Admin, Co-Founder) ──────────────────
  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.HR)
  @Get('staff')
  getStaffList(@Request() req: any) {
    return this.hrmsService.getStaffList(req.user.organizationId);
  }

  // ── Own profile ─────────────────────────────────────────────────────────
  @Get('profile')
  getProfile(@Request() req: any) {
    return this.hrmsService.getEmployeeProfile(req.user.id);
  }

  // ── Create user (Founder + HR) ───────────────────────────────────────────
  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.HR)
  @Post('users')
  createUser(@Request() req: any, @Body() body: CreateUserDto) {
    return this.hrmsService.createUser(req.user.organizationId, req.user.role, body);
  }

  // ── Update user (Founder + HR) ───────────────────────────────────────────
  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.HR)
  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Request() req: any, @Body() body: UpdateUserDto) {
    return this.hrmsService.updateUser(id, req.user.role, body);
  }

  // ── Deactivate / delete user (Founder + HR) ──────────────────────────────
  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.HR)
  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @Request() req: any) {
    return this.hrmsService.deleteUser(id, req.user.role);
  }

  // ── Reset password (Founder + HR) ────────────────────────────────────────
  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.HR)
  @Patch('users/:id/reset-password')
  resetPassword(@Param('id') id: string, @Request() req: any, @Body() body: ResetPasswordDto) {
    return this.hrmsService.resetUserPassword(id, body.newPassword, req.user.role);
  }

  // ── Grant permissions (FOUNDER ONLY) ─────────────────────────────────────
  @Roles(Role.FOUNDER, Role.CO_FOUNDER)
  @Patch('users/:id/permissions')
  grantPermissions(@Param('id') id: string, @Body() body: GrantPermissionsDto) {
    return this.hrmsService.grantPermissions(id, body.permissions);
  }

  // ── Attendance ────────────────────────────────────────────────────────────
  @Post('attendance/check-in')
  checkIn(@Request() req: any) {
    return this.hrmsService.checkIn(req.user.id);
  }

  // ── Attendance Check-Out ──────────────────────────────────────────────────
  @Post('attendance/check-out')
  checkOut(@Request() req: any) {
    return this.hrmsService.checkOut(req.user.id);
  }

  // ── Leaves ────────────────────────────────────────────────────────────────
  @Post('leaves')
  requestLeave(@Request() req: any, @Body() body: RequestLeaveDto) {
    return this.hrmsService.requestLeave(req.user.id, body);
  }

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.HR)
  @Patch('leaves/:id')
  updateLeaveStatus(@Param('id') id: string, @Body() body: UpdateLeaveStatusDto) {
    return this.hrmsService.updateLeaveStatus(id, body.status);
  }
}
