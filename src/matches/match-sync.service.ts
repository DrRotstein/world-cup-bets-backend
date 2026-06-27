import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MatchesService } from './matches.service';

@Injectable()
export class MatchSyncService {
  private readonly logger = new Logger(MatchSyncService.name);

  constructor(private readonly matchesService: MatchesService) {}

  /**
   * Sync matches every 5 minutes.
   * football-data.org free tier allows 10 req/min, so 1 req per 5 min is safe.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleSync(): Promise<void> {
    try {
      this.logger.log('Starting scheduled match sync...');
      const result = await this.matchesService.syncMatches();
      this.logger.log(
        `Scheduled sync finished: ${result.synced} synced, ${result.errors} errors`,
      );
    } catch (error) {
      this.logger.error(`Scheduled sync crashed unexpectedly: ${String(error)}`);
    }
  }
}
