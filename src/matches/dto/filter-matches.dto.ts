import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { MatchStatus } from '@prisma/client';

export class FilterMatchesDto {
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @IsOptional()
  stage?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
