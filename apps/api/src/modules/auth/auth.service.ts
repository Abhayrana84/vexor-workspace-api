import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DbService } from '../db/db.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private db: DbService,
    private jwtService: JwtService,
  ) {}

  /**
   * Generate a user ID:
   *   Employees → VXR{YY}{NNN}  e.g. VXR2601
   *   Clients   → CLNT{YY}{NNN} e.g. CLNT2601
   */
  private async generateUserId(orgId: string, role: string): Promise<{ userId: string; employeeNumber: number }> {
    const year = new Date().getFullYear().toString().slice(-2); // "26"
    const prefix = role === 'CLIENT' ? 'CLNT' : 'VXR';

    // Count existing users in org for this year prefix to get next number
    const existing = await this.db.user.findMany({
      where: { organizationId: orgId, userId: { startsWith: `${prefix}${year}` } },
      orderBy: { employeeNumber: 'desc' },
      take: 1,
    });

    const nextNumber = existing.length > 0 ? existing[0].employeeNumber + 1 : 1;
    const padded = String(nextNumber).padStart(3, '0');
    return { userId: `${prefix}${year}${padded}`, employeeNumber: nextNumber };
  }

  async register(data: {
    email: string;
    passwordText: string;
    firstName: string;
    lastName: string;
    orgName: string;
    role?: string;
    phone?: string;
    department?: string;
  }) {
    const existing = await this.db.user.findUnique({ where: { email: data.email } });
    if (existing) throw new BadRequestException('Email already exists');

    const passwordHash = await bcrypt.hash(data.passwordText, 10);

    let org = await this.db.organization.findFirst({ where: { name: data.orgName } });
    if (!org) {
      org = await this.db.organization.create({
        data: {
          name: data.orgName,
          slug: data.orgName.toLowerCase().replace(/\s+/g, '-'),
        },
      });
    }

    const role = data.role || 'DEVELOPER';
    const { userId, employeeNumber } = await this.generateUserId(org.id, role);

    const user = await this.db.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role,
        phone: data.phone,
        department: data.department,
        organizationId: org.id,
        userId,
        employeeNumber,
      },
    });

    return this.generateToken(user);
  }

  /**
   * Login accepts: email OR userId (VXR2601, CLNT2601)
   */
  async login(identifier: string, passwordText: string) {
    // Determine if identifier looks like a userId (starts with VXR or CLNT)
    const isUserId = /^(VXR|CLNT)\d+$/i.test(identifier.trim());

    const user = isUserId
      ? await this.db.user.findUnique({
          where: { userId: identifier.trim().toUpperCase() },
          include: { organization: true },
        })
      : await this.db.user.findUnique({
          where: { email: identifier.trim().toLowerCase() },
          include: { organization: true },
        });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is deactivated. Contact HR.');

    const matches = await bcrypt.compare(passwordText, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Invalid credentials');

    return this.generateToken(user);
  }

  private generateToken(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      userId: user.userId,
      organizationId: user.organizationId,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        bio: user.bio,
        department: user.department,
        organizationId: user.organizationId,
        avatarUrl: user.avatarUrl,
        permissions: user.permissions,
        isActive: user.isActive,
        employeeNumber: user.employeeNumber,
      },
    };
  }

  async updateProfile(userId: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    bio?: string;
    department?: string;
    avatarUrl?: string;
  }) {
    return this.db.user.update({
      where: { id: userId },
      data,
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db.user.update({ where: { id: userId }, data: { passwordHash } });
    return { success: true };
  }
}
