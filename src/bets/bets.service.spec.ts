import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BetsService } from './bets.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BetsService', () => {
  let service: BetsService;
  let prisma: {
    membership: Record<string, jest.Mock>;
    match: Record<string, jest.Mock>;
    bet: Record<string, jest.Mock>;
  };

  const futureDate = new Date(Date.now() + 86400000); // tomorrow
  const pastDate = new Date(Date.now() - 86400000); // yesterday

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

  beforeEach(async () => {
    prisma = {
      membership: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'user-1', groupId: 'group-1' }),
      },
      match: {
        findUnique: jest.fn().mockResolvedValue(mockMatch),
      },
      bet: {
        upsert: jest.fn().mockResolvedValue(mockBet),
        findMany: jest.fn().mockResolvedValue([mockBet]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<BetsService>(BetsService);
  });

  describe('placeBet', () => {
    it('should place a bet on a future match', async () => {
      const result = await service.placeBet('user-1', 'group-1', {
        matchId: 1001,
        homeScorePrediction: 2,
        awayScorePrediction: 1,
      });

      expect(result).toEqual(mockBet);
      expect(prisma.bet.upsert).toHaveBeenCalledWith({
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

    it('should throw ForbiddenException if user is not a group member', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);

      await expect(
        service.placeBet('user-1', 'group-1', {
          matchId: 1001,
          homeScorePrediction: 2,
          awayScorePrediction: 1,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if match does not exist', async () => {
      prisma.match.findUnique.mockResolvedValue(null);

      await expect(
        service.placeBet('user-1', 'group-1', {
          matchId: 9999,
          homeScorePrediction: 2,
          awayScorePrediction: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if match kickoff has passed', async () => {
      prisma.match.findUnique.mockResolvedValue({
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
      expect(prisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', groupId: 'group-1' },
        }),
      );
    });

    it('should throw ForbiddenException if not a member', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(service.getMyBets('user-1', 'group-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getMatchBets', () => {
    it('should return only own bet before kickoff', async () => {
      prisma.match.findUnique.mockResolvedValue({
        ...mockMatch,
        kickoffTime: futureDate,
      });

      await service.getMatchBets('user-1', 'group-1', 1001);
      expect(prisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId: 'group-1', matchId: 1001, userId: 'user-1' },
        }),
      );
    });

    it('should return all bets after kickoff', async () => {
      prisma.match.findUnique.mockResolvedValue({
        ...mockMatch,
        kickoffTime: pastDate,
      });

      await service.getMatchBets('user-1', 'group-1', 1001);
      expect(prisma.bet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { groupId: 'group-1', matchId: 1001 },
        }),
      );
    });

    it('should throw NotFoundException for non-existent match', async () => {
      prisma.match.findUnique.mockResolvedValue(null);
      await expect(service.getMatchBets('user-1', 'group-1', 9999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not a member', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(service.getMatchBets('user-1', 'group-1', 1001)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
