import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoreType } from '@prisma/client';

export interface PointCalculation {
  points: number;
  type: ScoreType;
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate points for a single bet given actual match result.
   *
   * Rules (D-003):
   * - 4 pts: exact score match
   * - 2 pts: correct goal difference
   * - 1 pt:  correct outcome (home/draw/away)
   * - 0 pts: wrong
   */
  calculatePoints(
    predictedHome: number,
    predictedAway: number,
    actualHome: number,
    actualAway: number,
  ): PointCalculation {
    // Exact score
    if (predictedHome === actualHome && predictedAway === actualAway) {
      return { points: 4, type: ScoreType.EXACT };
    }

    const predictedDiff = predictedHome - predictedAway;
    const actualDiff = actualHome - actualAway;

    // Correct goal difference
    if (predictedDiff === actualDiff) {
      return { points: 2, type: ScoreType.DIFF };
    }

    // Correct outcome (sign of difference)
    const predictedOutcome = Math.sign(predictedDiff);
    const actualOutcome = Math.sign(actualDiff);
    if (predictedOutcome === actualOutcome) {
      return { points: 1, type: ScoreType.OUTCOME };
    }

    return { points: 0, type: ScoreType.WRONG };
  }

  /**
   * Score all bets for a finished match. Called after match sync detects
   * a match has transitioned to FINISHED.
   */
  async scoreMatch(matchId: number): Promise<number> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match || match.homeScore === null || match.awayScore === null) {
      return 0;
    }

    const bets = await this.prisma.bet.findMany({
      where: { matchId },
    });

    let scored = 0;
    for (const bet of bets) {
      const { points, type } = this.calculatePoints(
        bet.homeScorePrediction,
        bet.awayScorePrediction,
        match.homeScore,
        match.awayScore,
      );

      await this.prisma.score.upsert({
        where: {
          userId_groupId_matchId: {
            userId: bet.userId,
            groupId: bet.groupId,
            matchId: bet.matchId,
          },
        },
        update: { points, type, betId: bet.id },
        create: {
          userId: bet.userId,
          groupId: bet.groupId,
          matchId: bet.matchId,
          betId: bet.id,
          points,
          type,
        },
      });
      scored++;
    }

    this.logger.log(`Scored ${scored} bets for match ${matchId}`);
    return scored;
  }

  /**
   * Score all finished matches that don't have scores yet (catch-up).
   */
  async scoreAllFinished(): Promise<number> {
    const finishedMatches = await this.prisma.match.findMany({
      where: {
        status: 'FINISHED',
        homeScore: { not: null },
        awayScore: { not: null },
      },
      select: { id: true },
    });

    let total = 0;
    for (const match of finishedMatches) {
      total += await this.scoreMatch(match.id);
    }
    return total;
  }
}
