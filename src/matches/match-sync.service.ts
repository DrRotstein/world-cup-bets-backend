import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MatchesService } from './matches.service';
import { ScoringService } from '../leaderboard/scoring.service';

@Injectable()
export class MatchSyncService {
  private readonly logger = new Logger(MatchSyncService.name);

  constructor(
    private readonly matchesService: MatchesService,
    @Optional() @Inject(ScoringService) private readonly scoringService?: ScoringService,
  ) {}

  /**
   * Sync matches every 5 minutes.
   * football-data.org free tier allows 10 req/min, so 1 req per 5 min is safe.
   * After sync, score all finished matches that have new results.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleSync(): Promise<void> {
    try {
      this.logger.log('Starting scheduled match sync...');
      const result = await this.matchesService.syncMatches();
      this.logger.log(
        `Scheduled sync finished: ${result.synced} synced, ${result.errors} errors`,
      );

      // Score all finished matches after sync
      if (this.scoringService && result.synced > 0) {
        const scored = await this.scoringService.scoreAllFinished();
        if (scored > 0) {
          this.logger.log(`Scored ${scored} bets after sync`);
        }
      }
    } catch (error) {
      this.logger.error(`Scheduled sync crashed unexpectedly: ${String(error)}`);
    }
  }
}
