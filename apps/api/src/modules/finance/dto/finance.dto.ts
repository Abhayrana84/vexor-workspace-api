import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsNumber()
  gst?: number;

  @IsDateString()
  dueDate!: string;

  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;
}

export class UpdateInvoiceStatusDto {
  @IsString()
  @IsNotEmpty()
  status!: string;
}

export class CreateCheckoutSessionDto {
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @IsString()
  @IsNotEmpty()
  successUrl!: string;

  @IsString()
  @IsNotEmpty()
  cancelUrl!: string;
}
