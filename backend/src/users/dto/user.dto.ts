import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { UserStatus } from '../../common/enums';
import {
  STRONG_PASSWORD,
  STRONG_PASSWORD_MSG,
} from '../../common/validators/strong-password';

export class CreateUserDto {
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsEmail() email!: string;
  @IsString() @Matches(STRONG_PASSWORD, { message: STRONG_PASSWORD_MSG }) password!: string;
  @IsInt() roleId!: number;

  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() employeeId?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEmail() email?: string; // login identifier — CEO/CTO only (enforced in service)
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() employeeId?: string; // HR/staff code (not the DB id)
  @IsOptional() @IsInt() roleId?: number;
}

export class UpdateStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}
