import { Controller, Post, Get, Patch, Body, UseGuards, Request, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Response } from 'express';
import { RegisterDto, LoginDto, UpdateProfileDto, ChangePasswordDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.register(body);
    const isProd = process.env.NODE_ENV === 'production';
    response.cookie('token', result.access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { user: result.user };
  }

  /** Accepts email OR userId (VXR2601 / CLNT2601) in the `identifier` field */
  @Post('login')
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const identifier = body.identifier || body.email;
    const result = await this.authService.login(identifier!, body.password);
    const isProd = process.env.NODE_ENV === 'production';
    response.cookie('token', result.access_token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { user: result.user };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) response: Response) {
    const isProd = process.env.NODE_ENV === 'production';
    response.clearCookie('token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req: any) {
    return {
      id: req.user.id,
      userId: req.user.userId,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      role: req.user.role,
      phone: req.user.phone,
      bio: req.user.bio,
      department: req.user.department,
      organizationId: req.user.organizationId,
      avatarUrl: req.user.avatarUrl,
      permissions: req.user.permissions,
      isActive: req.user.isActive,
      employeeNumber: req.user.employeeNumber,
    };
  }

  /** Any authenticated user can update their own profile */
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Request() req: any, @Body() body: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, body);
  }

  /** Any authenticated user can change their own password */
  @UseGuards(JwtAuthGuard)
  @Patch('password')
  async changePassword(@Request() req: any, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }
}
