import { Module } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchSyncService } from './match-sync.service';
import { FootballDataClient } from './football-data.client';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService, MatchSyncService, FootballDataClient],
  exports: [MatchesService],
})
export class MatchesModule {}
