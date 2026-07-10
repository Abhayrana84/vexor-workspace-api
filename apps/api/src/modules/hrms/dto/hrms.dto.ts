import { IsEmail, IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsDateString, IsEnum } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Provide a valid email.' })
  email!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  role!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsNumber()
  salary?: number;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsNumber()
  salary?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  newPassword!: string;
}

export class GrantPermissionsDto {
  @IsNotEmpty()
  permissions!: Record<string, boolean>;
}

export class RequestLeaveDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateLeaveStatusDto {
  @IsString()
  @IsNotEmpty()
  status!: string;
}
