import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '../../common/enums';

export class CreateTaskDto {
  @IsInt() projectId!: number;
  @IsString() title!: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() assignedTo?: number;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsDateString() dueDate?: string;
}

export class UpdateTaskDto {
  @IsOptional() @IsInt() projectId?: number;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() assignedTo?: number;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsDateString() dueDate?: string;
}

export class AssignTaskDto {
  @IsInt() assignedTo!: number;
}

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus) status!: TaskStatus;
}

export class SubmitTaskDto {
  // Optional note / link the assignee submits alongside their work.
  @IsOptional() @IsString() note?: string;
}

export class ReviewTaskDto {
  // Reviewer feedback for the assignee.
  @IsOptional() @IsString() feedback?: string;
  // Optional decision: e.g. DONE (approve) or IN_PROGRESS (request changes).
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
}
