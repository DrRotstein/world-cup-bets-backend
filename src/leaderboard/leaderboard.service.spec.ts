import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(async () => {
    prisma = {
      membership: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'user-1', groupId: 'group-1' }),
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'user-1',
            user: { id: 'user-1', displayName: 'Alice', avatarUrl: null },
          },
          {
            userId: 'user-2',
            user: { id: 'user-2', displayName: 'Bob', avatarUrl: null },
          },
        ]),
      },
      score: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      bet: { findMany: jest.fn().mockResolvedValue([]) },
      match: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [LeaderboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
  });

  describe('getLeaderboard', () => {
    it('should return ranked leaderboard entries', async () => {
      prisma.score.groupBy
        .mockResolvedValueOnce([
          { userId: 'user-1', _sum: { points: 10 }, _count: { id: 3 } },
          { userId: 'user-2', _sum: { points: 6 }, _count: { id: 2 } },
        ])
        .mockResolvedValueOnce([
          { userId: 'user-1', type: 'EXACT', _count: { id: 2 } },
          { userId: 'user-1', type: 'DIFF', _count: { id: 1 } },
          { userId: 'user-2', type: 'OUTCOME', _count: { id: 2 } },
        ]);

      const result = await service.getLeaderboard('user-1', 'group-1');

      expect(result).toHaveLength(2);
      expect(result[0].rank).toBe(1);
      expect(result[0].userId).toBe('user-1');
      expect(result[0].totalPoints).toBe(10);
      expect(result[0].exactCount).toBe(2);
      expect(result[1].rank).toBe(2);
      expect(result[1].userId).toBe('user-2');
      expect(result[1].totalPoints).toBe(6);
    });

    it('should sort by exact count on tie, then alphabetical', async () => {
      prisma.score.groupBy
        .mockResolvedValueOnce([
          { userId: 'user-1', _sum: { points: 8 }, _count: { id: 2 } },
          { userId: 'user-2', _sum: { points: 8 }, _count: { id: 2 } },
        ])
        .mockResolvedValueOnce([
          { userId: 'user-1', type: 'EXACT', _count: { id: 1 } },
          { userId: 'user-2', type: 'EXACT', _count: { id: 2 } },
        ]);

      const result = await service.getLeaderboard('user-1', 'group-1');

      // user-2 has more exact predictions, ranks higher
      expect(result[0].userId).toBe('user-2');
      expect(result[1].userId).toBe('user-1');
    });

    it('should throw NotFoundException for non-member', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(service.getLeaderboard('user-1', 'group-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserBreakdown', () => {
    it('should return per-match point breakdown', async () => {
      prisma.score.findMany.mockResolvedValue([
        { matchId: 1001, points: 4, type: 'EXACT', userId: 'user-1', groupId: 'group-1' },
      ]);
      prisma.bet.findMany.mockResolvedValue([
        { matchId: 1001, homeScorePrediction: 2, awayScorePrediction: 1 },
      ]);
      prisma.match.findMany.mockResolvedValue([
        { id: 1001, homeTeam: 'Brazil', awayTeam: 'Germany', homeScore: 2, awayScore: 1 },
      ]);

      const result = await service.getUserBreakdown('user-1', 'group-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        matchId: 1001,
        homeTeam: 'Brazil',
        awayTeam: 'Germany',
        actualHome: 2,
        actualAway: 1,
        predictedHome: 2,
        predictedAway: 1,
        points: 4,
        type: 'EXACT',
      });
    });

    it('should throw NotFoundException for non-member', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(
        service.getUserBreakdown('user-1', 'group-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
