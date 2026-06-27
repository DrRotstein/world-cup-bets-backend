import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Bet } from '@prisma/client';

@Injectable()
export class BetsService {
  constructor(private readonly prisma: PrismaService) {}

  async placeBet(
    userId: string,
    groupId: string,
    data: {
      matchId: number;
      homeScorePrediction: number;
      awayScorePrediction: number;
    },
  ): Promise<Bet> {
    // Verify user is a member of the group
    const membership = await this.prisma.membership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) {
      throw new NotFoundException('Group not found');
    }

    // Use $transaction to guard against kickoff race condition:
    // check time and upsert atomically within the same DB round-trip.
    return this.prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: data.matchId },
      });
      if (!match) {
        throw new NotFoundException(`Match ${data.matchId} not found`);
      }
      if (match.kickoffTime <= new Date()) {
        throw new BadRequestException('Cannot place or update bet after match kickoff');
      }

      return tx.bet.upsert({
        where: {
          userId_groupId_matchId: {
            userId,
            groupId,
            matchId: data.matchId,
          },
        },
        update: {
          homeScorePrediction: data.homeScorePrediction,
          awayScorePrediction: data.awayScorePrediction,
        },
        create: {
          userId,
          groupId,
          matchId: data.matchId,
          homeScorePrediction: data.homeScorePrediction,
          awayScorePrediction: data.awayScorePrediction,
        },
      });
    });
  }

  async getMyBets(userId: string, groupId: string): Promise<Bet[]> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) {
      throw new NotFoundException('Group not found');
    }

    return this.prisma.bet.findMany({
      where: { userId, groupId },
      include: {
        match: {
          select: {
            id: true,
            homeTeam: true,
            awayTeam: true,
            kickoffTime: true,
            status: true,
            homeScore: true,
            awayScore: true,
          },
        },
      },
      orderBy: { match: { kickoffTime: 'asc' } },
    });
  }

  async getMatchBets(userId: string, groupId: string, matchId: number): Promise<Bet[]> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) {
      throw new NotFoundException('Group not found');
    }

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });
    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    // Only show other users' bets after kickoff (prevent copying)
    if (match.kickoffTime > new Date()) {
      return this.prisma.bet.findMany({
        where: { groupId, matchId, userId },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      });
    }

    return this.prisma.bet.findMany({
      where: { groupId, matchId },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
