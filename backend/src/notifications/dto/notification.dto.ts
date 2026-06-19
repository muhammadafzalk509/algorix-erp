import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export const AUDIENCES = ['GLOBAL', 'TECHNICAL', 'TEAM', 'DEV'] as const;
export type Audience = (typeof AUDIENCES)[number];

export class BroadcastDto {
  @IsIn(AUDIENCES) audience!: Audience;
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() message!: string;
}
