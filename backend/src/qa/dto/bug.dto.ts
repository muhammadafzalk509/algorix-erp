import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { BugSeverity, BugStatus } from '../../common/enums';

export class CreateBugDto {
  @IsOptional() @IsInt() taskId?: number;
  @IsString() @IsNotEmpty() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(BugSeverity) severity?: BugSeverity;
}

export class UpdateBugStatusDto {
  @IsEnum(BugStatus) status!: BugStatus;
}
