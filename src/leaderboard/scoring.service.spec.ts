import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from './scoring.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScoreType } from '@prisma/client';

describe('ScoringService', () => {
  let service: ScoringService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(async () => {
    prisma = {
      match: { findUnique: jest.fn(), findMany: jest.fn() },
      bet: { findMany: jest.fn() },
      score: { upsert: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ScoringService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ScoringService>(ScoringService);
  });

  describe('calculatePoints', () => {
    it('should return 4 points for exact score match', () => {
      const result = service.calculatePoints(2, 1, 2, 1);
      expect(result).toEqual({ points: 4, type: ScoreType.EXACT });
    });

    it('should return 4 points for exact 0-0 draw', () => {
      const result = service.calculatePoints(0, 0, 0, 0);
      expect(result).toEqual({ points: 4, type: ScoreType.EXACT });
    });

    it('should return 2 points for correct goal difference', () => {
      // Predicted 3-1 (diff +2), actual 2-0 (diff +2)
      const result = service.calculatePoints(3, 1, 2, 0);
      expect(result).toEqual({ points: 2, type: ScoreType.DIFF });
    });

    it('should return 2 points for correct goal diff on draw', () => {
      // Predicted 1-1 (diff 0), actual 2-2 (diff 0)
      const result = service.calculatePoints(1, 1, 2, 2);
      expect(result).toEqual({ points: 2, type: ScoreType.DIFF });
    });

    it('should return 1 point for correct outcome only (home win)', () => {
      // Predicted 3-0 (home win, diff +3), actual 1-0 (home win, diff +1)
      const result = service.calculatePoints(3, 0, 1, 0);
      expect(result).toEqual({ points: 1, type: ScoreType.OUTCOME });
    });

    it('should return 1 point for correct outcome only (away win)', () => {
      // Predicted 0-1, actual 0-3
      const result = service.calculatePoints(0, 1, 0, 3);
      expect(result).toEqual({ points: 1, type: ScoreType.OUTCOME });
    });

    it('should return 0 points for wrong outcome', () => {
      // Predicted home win (2-1), actual away win (0-1)
      const result = service.calculatePoints(2, 1, 0, 1);
      expect(result).toEqual({ points: 0, type: ScoreType.WRONG });
    });

    it('should return 0 points when predicting draw but result is not', () => {
      // Predicted 1-1, actual 2-1
      const result = service.calculatePoints(1, 1, 2, 1);
      expect(result).toEqual({ points: 0, type: ScoreType.WRONG });
    });

    it('should return 0 points when predicting win but result is draw', () => {
      // Predicted 2-0, actual 1-1
      const result = service.calculatePoints(2, 0, 1, 1);
      expect(result).toEqual({ points: 0, type: ScoreType.WRONG });
    });
  });

  describe('scoreMatch', () => {
    it('should score all bets for a finished match', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 1001,
        homeScore: 2,
        awayScore: 1,
      });
      prisma.bet.findMany.mockResolvedValue([
        {
          id: 'bet-1',
          userId: 'user-1',
          groupId: 'group-1',
          matchId: 1001,
          homeScorePrediction: 2,
          awayScorePrediction: 1,
        },
        {
          id: 'bet-2',
          userId: 'user-2',
          groupId: 'group-1',
          matchId: 1001,
          homeScorePrediction: 3,
          awayScorePrediction: 0,
        },
      ]);
      prisma.score.upsert.mockResolvedValue({});

      const result = await service.scoreMatch(1001);
      expect(result).toBe(2);
      expect(prisma.score.upsert).toHaveBeenCalledTimes(2);

      // First bet: exact (4 pts)
      expect(prisma.score.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            points: 4,
            type: ScoreType.EXACT,
          }),
        }),
      );
    });

    it('should return 0 if match has no scores', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 1001,
        homeScore: null,
        awayScore: null,
      });

      const result = await service.scoreMatch(1001);
      expect(result).toBe(0);
    });

    it('should return 0 if match not found', async () => {
      prisma.match.findUnique.mockResolvedValue(null);

      const result = await service.scoreMatch(9999);
      expect(result).toBe(0);
    });
  });

  describe('scoreAllFinished', () => {
    it('should score all finished matches', async () => {
      prisma.match.findMany.mockResolvedValue([{ id: 1001 }, { id: 1002 }]);
      prisma.match.findUnique.mockResolvedValue({
        id: 1001,
        homeScore: 2,
        awayScore: 1,
      });
      prisma.bet.findMany.mockResolvedValue([]);

      const result = await service.scoreAllFinished();
      expect(result).toBe(0);
      expect(prisma.match.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'FINISHED' }),
        }),
      );
    });
  });
});
