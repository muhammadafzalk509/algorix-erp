import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SetSalaryDto {
  @IsNumber() @Min(0) baseSalary!: number;
  @IsOptional() @IsString() currency?: string;
}

export class CreateEntryDto {
  @IsInt() userId!: number;
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
  @IsNumber() @Min(0) baseSalary!: number;
  @IsOptional() @IsNumber() @Min(0) bonus?: number;
  @IsOptional() @IsNumber() @Min(0) deductions?: number;
  @IsOptional() @IsNumber() @Min(0) overtime?: number;
  @IsOptional() @IsString() note?: string;
}
