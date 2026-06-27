import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Match, MatchStatus, Prisma } from '@prisma/client';
import { FootballDataClient, FootballDataMatch } from './football-data.client';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly footballDataClient: FootballDataClient,
  ) {}

  async findAll(filters?: {
    status?: MatchStatus;
    stage?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<Match[]> {
    const where: Prisma.MatchWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.stage) {
      where.stage = filters.stage;
    }
    if (filters?.dateFrom || filters?.dateTo) {
      where.kickoffTime = {};
      if (filters.dateFrom) {
        where.kickoffTime.gte = filters.dateFrom;
      }
      if (filters?.dateTo) {
        where.kickoffTime.lte = filters.dateTo;
      }
    }

    return this.prisma.match.findMany({
      where,
      orderBy: { kickoffTime: 'asc' },
    });
  }

  async findById(id: number): Promise<Match | null> {
    return this.prisma.match.findUnique({ where: { id } });
  }

  async syncMatches(): Promise<{ synced: number; errors: number }> {
    let synced = 0;
    let errors = 0;

    try {
      const externalMatches = await this.footballDataClient.getMatches();

      for (const match of externalMatches) {
        try {
          await this.upsertMatch(match);
          synced++;
        } catch (error) {
          errors++;
          this.logger.error(`Failed to upsert match ${match.id}: ${String(error)}`);
        }
      }

      this.logger.log(`Sync complete: ${synced} matches synced, ${errors} errors`);
    } catch (error) {
      this.logger.error(`Sync failed: ${String(error)}`);
      // Don't rethrow — serve cached data
    }

    return { synced, errors };
  }

  private async upsertMatch(match: FootballDataMatch): Promise<void> {
    const status = this.mapStatus(match.status);

    await this.prisma.match.upsert({
      where: { id: match.id },
      update: {
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        kickoffTime: new Date(match.utcDate),
        status,
        homeScore: match.score.fullTime.home,
        awayScore: match.score.fullTime.away,
        matchday: match.matchday,
        stage: match.stage,
        group: match.group,
        lastSyncedAt: new Date(),
      },
      create: {
        id: match.id,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        kickoffTime: new Date(match.utcDate),
        status,
        homeScore: match.score.fullTime.home,
        awayScore: match.score.fullTime.away,
        matchday: match.matchday,
        stage: match.stage,
        group: match.group,
        lastSyncedAt: new Date(),
      },
    });
  }

  private mapStatus(externalStatus: string): MatchStatus {
    switch (externalStatus) {
      case 'FINISHED':
        return MatchStatus.FINISHED;
      case 'IN_PLAY':
      case 'PAUSED':
      case 'HALFTIME':
        return MatchStatus.LIVE;
      default:
        return MatchStatus.SCHEDULED;
    }
  }
}
