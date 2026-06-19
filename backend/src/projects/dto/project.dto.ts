import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ProjectStatus } from '../../common/enums';

export class CreateProjectDto {
  @IsInt() clientId!: number;
  @IsString() title!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() budget?: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
}

export class UpdateProjectDto {
  @IsOptional() @IsInt() clientId?: number;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() budget?: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
}

export class CreateMilestoneDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) completion?: number;
}

export class UpdateMilestoneDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) completion?: number;
}
