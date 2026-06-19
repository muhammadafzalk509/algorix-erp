import { IsDateString, IsEnum, IsInt } from 'class-validator';
import { AttendanceStatus } from '../../common/enums';

export class OverrideDto {
  @IsInt() userId!: number;
  @IsDateString() date!: string; // YYYY-MM-DD
  @IsEnum(AttendanceStatus) status!: AttendanceStatus;
}
