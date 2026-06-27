import { IsInt, Min } from 'class-validator';

export class PlaceBetDto {
  @IsInt()
  matchId!: number;

  @IsInt()
  @Min(0)
  homeScorePrediction!: number;

  @IsInt()
  @Min(0)
  awayScorePrediction!: number;
}
