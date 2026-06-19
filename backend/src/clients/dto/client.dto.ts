import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateClientDto {
  @IsString() name!: string;
  @IsEmail() email!: string;

  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() taxDetails?: string;
}

export class UpdateClientDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() companyName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() paymentTerms?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() taxDetails?: string;
}
