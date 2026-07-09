import { IsEmail, IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  contactName!: string;

  @IsEmail({}, { message: 'Provide a valid email.' })
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  score?: number;
}

export class UpdateLeadStatusDto {
  @IsString()
  @IsNotEmpty()
  status!: string;

  @IsOptional()
  @IsString()
  detail?: string;
}

export class AssignLeadDto {
  @IsString()
  @IsNotEmpty()
  assigneeId!: string;
}
