import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BetsService } from './bets.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BetsService', () => {
  let service: BetsService;
  let prisma: Record<string, unknown>;

  const futureDate = new Date(Date.now() + 86400000);
  const pastDate = new Date(Date.now() - 86400000);

  const mockMatch = {
    id: 1001,
    homeTeam: 'Brazil',
    awayTeam: 'Germany',
    kickoffTime: futureDate,
    status: 'SCHEDULED',
    homeScore: null,
    awayScore: null,
  };

  const mockBet = {
    id: 'bet-1',
    userId: 'user-1',
    groupId: 'group-1',
    matchId: 1001,
    homeScorePrediction: 2,
    awayScorePrediction: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let mockTx: {
    match: Record<string, jest.Mock>;
    bet: Record<string, jest.Mock>;
  };

  beforeEach(async () => {
    mockTx = {
      match: { findUnique: jest.fn().mockResolvedValue(mockMatch) },
      bet: { upsert: jest.fn().mockResolvedValue(mockBet) },
    };

    prisma = {
      membership: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'user-1', groupId: 'group-1' }),
      },
      match: { findUnique: jest.fn().mockResolvedValue(mockMatch) },
      bet: {
        upsert: jest.fn().mockResolvedValue(mockBet),
        findMany: jest.fn().mockResolvedValue([mockBet]),
      },
      $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<BetsService>(BetsService);
  });

  describe('placeBet', () => {
    it('should place a bet on a future match within a transaction', async () => {
      const result = await service.placeBet('user-1', 'group-1', {
        matchId: 1001,
        homeScorePrediction: 2,
        awayScorePrediction: 1,
      });

      expect(result).toEqual(mockBet);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.match.findUnique).toHaveBeenCalledWith({
        where: { id: 1001 },
      });
      expect(mockTx.bet.upsert).toHaveBeenCalledWith({
        where: {
          userId_groupId_matchId: {
            userId: 'user-1',
            groupId: 'group-1',
            matchId: 1001,
          },
        },
        update: { homeScorePrediction: 2, awayScorePrediction: 1 },
        create: {
          userId: 'user-1',
          groupId: 'group-1',
          matchId: 1001,
          homeScorePrediction: 2,
          awayScorePrediction: 1,
        },
      });
    });

    it('should throw NotFoundException if user is not a group member', async () => {
      (prisma.membership as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);

      await expect(
        service.placeBet('user-1', 'group-1', {
          matchId: 1001,
          homeScorePrediction: 2,
          awayScorePrediction: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if match does not exist', async () => {
      mockTx.match.findUnique.mockResolvedValue(null);

      await expect(
        service.placeBet('user-1', 'group-1', {
          matchId: 9999,
          homeScorePrediction: 2,
          awayScorePrediction: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if match kickoff has passed', async () => {
      mockTx.match.findUnique.mockResolvedValue({
        ...mockMatch,
        kickoffTime: pastDate,
      });

      await expect(
        service.placeBet('user-1', 'group-1', {
          matchId: 1001,
          homeScorePrediction: 2,
          awayScorePrediction: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMyBets', () => {
    it('should return user bets in a group', async () => {
      const result = await service.getMyBets('user-1', 'group-1');
      expect(result).toEqual([mockBet]);
    });

    it('should throw NotFoundException if not a member', async () => {
      (prisma.membership as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);
      await expect(service.getMyBets('user-1', 'group-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMatchBets', () => {
    it('should return only own bet before kickoff', async () => {
      (prisma.match as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
        ...mockMatch,
        kickoffTime: futureDate,
      });

      await service.getMatchBets('user-1', 'group-1', 1001);
      expect((prisma.bet as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId: 'group-1', matchId: 1001, userId: 'user-1' },
        }),
      );
    });

    it('should return all bets after kickoff', async () => {
      (prisma.match as { findUnique: jest.Mock }).findUnique.mockResolvedValue({
        ...mockMatch,
        kickoffTime: pastDate,
      });

      await service.getMatchBets('user-1', 'group-1', 1001);
      expect((prisma.bet as { findMany: jest.Mock }).findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId: 'group-1', matchId: 1001 },
        }),
      );
    });

    it('should throw NotFoundException for non-existent match', async () => {
      (prisma.match as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);
      await expect(service.getMatchBets('user-1', 'group-1', 9999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if not a member', async () => {
      (prisma.membership as { findUnique: jest.Mock }).findUnique.mockResolvedValue(null);
      await expect(service.getMatchBets('user-1', 'group-1', 1001)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
