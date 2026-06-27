import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalPoints: number;
  exactCount: number;
  diffCount: number;
  outcomeCount: number;
  rank: number;
}

export interface MatchBreakdown {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  actualHome: number | null;
  actualAway: number | null;
  predictedHome: number;
  predictedAway: number;
  points: number;
  type: string;
}

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(userId: string, groupId: string): Promise<LeaderboardEntry[]> {
    // Verify membership
    const membership = await this.prisma.membership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) {
      throw new NotFoundException('Group not found');
    }

    // Get all members of the group
    const members = await this.prisma.membership.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // Get aggregated scores per user in this group
    const scores = await this.prisma.score.groupBy({
      by: ['userId'],
      where: { groupId },
      _sum: { points: true },
      _count: { id: true },
    });

    // Get type counts per user
    const typeCounts = await this.prisma.score.groupBy({
      by: ['userId', 'type'],
      where: { groupId },
      _count: { id: true },
    });

    // Build leaderboard entries
    const entries: LeaderboardEntry[] = members.map((m) => {
      const userScore = scores.find((s) => s.userId === m.userId);
      const userTypes = typeCounts.filter((t) => t.userId === m.userId);

      return {
        userId: m.user.id,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
        totalPoints: userScore?._sum.points ?? 0,
        exactCount: userTypes.find((t) => t.type === 'EXACT')?._count.id ?? 0,
        diffCount: userTypes.find((t) => t.type === 'DIFF')?._count.id ?? 0,
        outcomeCount: userTypes.find((t) => t.type === 'OUTCOME')?._count.id ?? 0,
        rank: 0,
      };
    });

    // Sort: total points desc, then exact count desc, then alphabetical
    entries.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
      return a.displayName.localeCompare(b.displayName);
    });

    // Assign ranks
    entries.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });

    return entries;
  }

  async getUserBreakdown(
    requestingUserId: string,
    groupId: string,
    targetUserId: string,
  ): Promise<MatchBreakdown[]> {
    // Verify membership
    const membership = await this.prisma.membership.findUnique({
      where: { userId_groupId: { userId: requestingUserId, groupId } },
    });
    if (!membership) {
      throw new NotFoundException('Group not found');
    }

    // Get all scores for this user in this group, joined with bet and match
    const scores = await this.prisma.score.findMany({
      where: { userId: targetUserId, groupId },
    });

    if (scores.length === 0) {
      return [];
    }

    // Get bets and matches for these scores
    const matchIds = scores.map((s) => s.matchId);
    const [bets, matches] = await Promise.all([
      this.prisma.bet.findMany({
        where: { userId: targetUserId, groupId, matchId: { in: matchIds } },
      }),
      this.prisma.match.findMany({
        where: { id: { in: matchIds } },
      }),
    ]);

    return scores.map((score) => {
      const bet = bets.find((b) => b.matchId === score.matchId);
      const match = matches.find((m) => m.id === score.matchId);

      return {
        matchId: score.matchId,
        homeTeam: match?.homeTeam ?? 'Unknown',
        awayTeam: match?.awayTeam ?? 'Unknown',
        actualHome: match?.homeScore ?? null,
        actualAway: match?.awayScore ?? null,
        predictedHome: bet?.homeScorePrediction ?? 0,
        predictedAway: bet?.awayScorePrediction ?? 0,
        points: score.points,
        type: score.type,
      };
    });
  }
}
