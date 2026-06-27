export interface BetResponseDto {
  id: string;
  matchId: number;
  homeScorePrediction: number;
  awayScorePrediction: number;
  createdAt: Date;
  updatedAt: Date;
}
