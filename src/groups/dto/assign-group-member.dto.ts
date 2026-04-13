import { IsString, IsOptional, IsUUID } from 'class-validator';

export class AssignGroupMemberDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  username?: string;
}
