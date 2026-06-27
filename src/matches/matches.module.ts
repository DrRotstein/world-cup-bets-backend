import { Module, forwardRef } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchSyncService } from './match-sync.service';
import { FootballDataClient } from './football-data.client';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';

@Module({
  imports: [forwardRef(() => LeaderboardModule)],
  controllers: [MatchesController],
  providers: [MatchesService, MatchSyncService, FootballDataClient],
  exports: [MatchesService],
})
export class MatchesModule {}
