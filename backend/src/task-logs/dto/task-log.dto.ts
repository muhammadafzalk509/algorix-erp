import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateTaskLogDto {
  @IsInt() taskId!: number;
  @IsString() workDescription!: string;

  @IsNumber()
  @Min(0.1)
  @Max(12)
  hoursSpent!: number;

  @IsDateString() date!: string;

  @IsOptional() @IsString() githubUrl?: string;
  @IsOptional() @IsString() commitId?: string;
  @IsOptional() @IsString() branchName?: string;
}
