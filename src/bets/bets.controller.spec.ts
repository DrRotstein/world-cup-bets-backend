import { Test, TestingModule } from '@nestjs/testing';
import { BetsController } from './bets.controller';
import { BetsService } from './bets.service';

describe('BetsController', () => {
  let controller: BetsController;
  let betsService: jest.Mocked<BetsService>;

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

  const mockReq = {
    user: { userId: 'user-1', email: 'test@example.com' },
  } as Parameters<typeof controller.placeBet>[0];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BetsController],
      providers: [
        {
          provide: BetsService,
          useValue: {
            placeBet: jest.fn().mockResolvedValue(mockBet),
            getMyBets: jest.fn().mockResolvedValue([mockBet]),
            getMatchBets: jest.fn().mockResolvedValue([mockBet]),
          },
        },
      ],
    }).compile();

    controller = module.get<BetsController>(BetsController);
    betsService = module.get(BetsService) as jest.Mocked<BetsService>;
  });

  describe('POST /groups/:groupId/bets', () => {
    it('should place a bet and return shaped response', async () => {
      const result = await controller.placeBet(mockReq, 'group-1', {
        matchId: 1001,
        homeScorePrediction: 2,
        awayScorePrediction: 1,
      });

      expect(result).toEqual({
        id: 'bet-1',
        matchId: 1001,
        homeScorePrediction: 2,
        awayScorePrediction: 1,
        createdAt: mockBet.createdAt,
        updatedAt: mockBet.updatedAt,
      });
      // Verify no userId/groupId leaked in response
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('groupId');
      expect(betsService.placeBet).toHaveBeenCalledWith('user-1', 'group-1', {
        matchId: 1001,
        homeScorePrediction: 2,
        awayScorePrediction: 1,
      });
    });
  });

  describe('GET /groups/:groupId/bets', () => {
    it('should return user bets', async () => {
      const result = await controller.getMyBets(mockReq, 'group-1');
      expect(result).toEqual([mockBet]);
      expect(betsService.getMyBets).toHaveBeenCalledWith('user-1', 'group-1');
    });
  });

  describe('GET /groups/:groupId/bets/matches/:matchId', () => {
    it('should return match bets', async () => {
      const result = await controller.getMatchBets(mockReq, 'group-1', 1001);
      expect(result).toEqual([mockBet]);
      expect(betsService.getMatchBets).toHaveBeenCalledWith('user-1', 'group-1', 1001);
    });
  });
});
