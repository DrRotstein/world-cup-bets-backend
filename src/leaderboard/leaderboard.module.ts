import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { ScoringService } from './scoring.service';

@Module({
  controllers: [LeaderboardController],
  providers: [LeaderboardService, ScoringService],
  exports: [ScoringService],
})
export class LeaderboardModule {}
