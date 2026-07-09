import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class HrmsService {
  constructor(private db: DbService) {}

  // ─── People grouped by role ─────────────────────────────────────────────

  async getStaffList(orgId: string) {
    const users = await this.db.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true, userId: true, employeeNumber: true, email: true,
        firstName: true, lastName: true, role: true, phone: true,
        bio: true, department: true, avatarUrl: true,
        permissions: true, isActive: true, createdAt: true,
        employeeProfile: { select: { id: true } },
      },
      orderBy: { employeeNumber: 'asc' },
    });

    // Group by role
    const groups: Record<string, any[]> = {};
    for (const u of users) {
      if (!groups[u.role]) groups[u.role] = [];
      groups[u.role].push(u);
    }
    return { users, groups };
  }

  async getEmployeeProfile(userId: string) {
    const profile = await this.db.employeeProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true, userId: true, employeeNumber: true,
            firstName: true, lastName: true, email: true,
            phone: true, bio: true, department: true,
            avatarUrl: true, role: true, permissions: true, isActive: true,
          },
        },
        attendance: { orderBy: { checkIn: 'desc' }, take: 10 },
        leaves: { orderBy: { startDate: 'desc' } },
      },
    });
    if (!profile) throw new NotFoundException('Employee profile not found');
    return profile;
  }

  // ─── Create user (Founder + HR) ─────────────────────────────────────────

  async createUser(orgId: string, requesterRole: string, data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    phone?: string;
    bio?: string;
    department?: string;
  }) {
    const existing = await this.db.user.findUnique({ where: { email: data.email } });
    if (existing) throw new BadRequestException('Email already in use');

    // HR cannot create FOUNDER or CO_FOUNDER
    if (requesterRole === 'HR_MANAGER' && ['FOUNDER', 'CO_FOUNDER'].includes(data.role)) {
      throw new ForbiddenException('HR cannot create Founder-level accounts');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    // Generate user ID
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = data.role === 'CLIENT' ? 'CLNT' : 'VXR';
    const existingOfType = await this.db.user.findMany({
      where: { organizationId: orgId, userId: { startsWith: `${prefix}${year}` } },
      orderBy: { employeeNumber: 'desc' }, take: 1,
    });
    const nextNumber = existingOfType.length > 0 ? existingOfType[0].employeeNumber + 1 : 1;
    const userId = `${prefix}${year}${String(nextNumber).padStart(3, '0')}`;

    const defaultPerms = {
      crm: ['FOUNDER','CO_FOUNDER','ADMIN','SALES_MANAGER','SALES_EXECUTIVE'].includes(data.role),
      finance: ['FOUNDER','CO_FOUNDER','ADMIN','FINANCE_MANAGER'].includes(data.role),
      hrms: ['FOUNDER','CO_FOUNDER','ADMIN','HR_MANAGER'].includes(data.role),
      projects: ['FOUNDER','CO_FOUNDER','ADMIN','PROJECT_MANAGER','DEVELOPER'].includes(data.role),
      monitoring: ['FOUNDER','CO_FOUNDER','ADMIN','DEVELOPER'].includes(data.role),
      ai: true,
    };

    const user = await this.db.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        phone: data.phone,
        bio: data.bio,
        department: data.department,
        organizationId: orgId,
        userId,
        employeeNumber: nextNumber,
        isActive: true,
        permissions: JSON.stringify(defaultPerms),
      },
    });

    return {
      id: user.id, userId: user.userId, email: user.email,
      firstName: user.firstName, lastName: user.lastName,
      role: user.role, employeeNumber: user.employeeNumber,
    };
  }

  // ─── Update user (Founder + HR) ─────────────────────────────────────────

  async updateUser(userId: string, requesterRole: string, data: {
    firstName?: string;
    lastName?: string;
    role?: string;
    phone?: string;
    bio?: string;
    department?: string;
    avatarUrl?: string;
    isActive?: boolean;
  }) {
    const target = await this.db.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');

    // HR cannot change FOUNDER or CO_FOUNDER
    if (requesterRole === 'HR_MANAGER' && ['FOUNDER', 'CO_FOUNDER'].includes(target.role)) {
      throw new ForbiddenException('HR cannot edit Founder-level accounts');
    }

    return this.db.user.update({ where: { id: userId }, data });
  }

  // ─── Delete user (Founder + HR) ─────────────────────────────────────────

  async deleteUser(userId: string, requesterRole: string) {
    const target = await this.db.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');

    if (requesterRole === 'HR_MANAGER' && ['FOUNDER', 'CO_FOUNDER'].includes(target.role)) {
      throw new ForbiddenException('HR cannot delete Founder-level accounts');
    }

    // Soft delete — deactivate instead of hard delete
    return this.db.user.update({ where: { id: userId }, data: { isActive: false } });
  }

  // ─── Grant permissions (FOUNDER ONLY) ───────────────────────────────────

  async grantPermissions(targetUserId: string, permissions: Record<string, boolean>) {
    const target = await this.db.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    return this.db.user.update({
      where: { id: targetUserId },
      data: { permissions: JSON.stringify(permissions) },
    });
  }

  // ─── Reset password (Founder + HR) ──────────────────────────────────────

  async resetUserPassword(targetUserId: string, newPassword: string, requesterRole: string) {
    const target = await this.db.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    if (requesterRole === 'HR_MANAGER' && ['FOUNDER', 'CO_FOUNDER'].includes(target.role)) {
      throw new ForbiddenException('HR cannot reset Founder-level passwords');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db.user.update({ where: { id: targetUserId }, data: { passwordHash } });
    return { success: true };
  }

  // ─── Attendance ──────────────────────────────────────────────────────────

  async checkIn(userId: string) {
    const profile = await this.db.employeeProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Employee profile not found');

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const existing = await this.db.attendance.findFirst({
      where: { employeeProfileId: profile.id, checkIn: { gte: today } },
    });
    if (existing) throw new BadRequestException('Already checked in today');

    const currentHour = new Date().getHours();
    return this.db.attendance.create({
      data: { employeeProfileId: profile.id, status: currentHour >= 10 ? 'LATE' : 'PRESENT' },
    });
  }

  async checkOut(userId: string) {
    const profile = await this.db.employeeProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Employee profile not found');

    const last = await this.db.attendance.findFirst({
      where: { employeeProfileId: profile.id, checkOut: null },
      orderBy: { checkIn: 'desc' },
    });
    if (!last) throw new BadRequestException('No active check-in found');

    return this.db.attendance.update({ where: { id: last.id }, data: { checkOut: new Date() } });
  }

  async requestLeave(userId: string, data: { startDate: Date | string; endDate: Date | string; type: string; reason?: string }) {
    const profile = await this.db.employeeProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Employee profile not found');

    return this.db.leave.create({
      data: {
        employeeProfileId: profile.id,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        type: data.type,
        reason: data.reason,
      },
    });
  }

  async updateLeaveStatus(leaveId: string, status: string) {
    const leave = await this.db.leave.findUnique({ where: { id: leaveId } });
    if (!leave) throw new NotFoundException('Leave not found');
    return this.db.leave.update({ where: { id: leaveId }, data: { status } });
  }
}
