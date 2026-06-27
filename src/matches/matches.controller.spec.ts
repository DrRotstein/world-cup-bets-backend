import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchStatus } from '@prisma/client';

describe('MatchesController', () => {
  let controller: MatchesController;
  let matchesService: jest.Mocked<MatchesService>;

  const mockMatches = [
    {
      id: 1001,
      homeTeam: 'Brazil',
      awayTeam: 'Germany',
      kickoffTime: new Date('2026-07-10T18:00:00Z'),
      status: MatchStatus.SCHEDULED,
      homeScore: null,
      awayScore: null,
      matchday: 1,
      stage: 'GROUP_STAGE',
      group: 'Group A',
      lastSyncedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController],
      providers: [
        {
          provide: MatchesService,
          useValue: {
            findAll: jest.fn().mockResolvedValue(mockMatches),
            findById: jest.fn().mockResolvedValue(mockMatches[0]),
          },
        },
      ],
    }).compile();

    controller = module.get<MatchesController>(MatchesController);
    matchesService = module.get(MatchesService) as jest.Mocked<MatchesService>;
  });

  describe('GET /matches', () => {
    it('should return all matches', async () => {
      const result = await controller.findAll({});
      expect(result).toEqual(mockMatches);
    });

    it('should pass filters to service', async () => {
      await controller.findAll({
        status: MatchStatus.FINISHED,
        stage: 'GROUP_STAGE',
      });
      expect(matchesService.findAll).toHaveBeenCalledWith({
        status: MatchStatus.FINISHED,
        stage: 'GROUP_STAGE',
        dateFrom: undefined,
        dateTo: undefined,
      });
    });

    it('should parse date filters', async () => {
      await controller.findAll({ dateFrom: '2026-07-10' });
      expect(matchesService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: expect.any(Date),
        }),
      );
    });
  });

  describe('GET /matches/:id', () => {
    it('should return a match by id', async () => {
      const result = await controller.findOne(1001);
      expect(result).toEqual(mockMatches[0]);
    });

    it('should throw NotFoundException when match not found', async () => {
      matchesService.findById.mockResolvedValue(null);
      await expect(controller.findOne(9999)).rejects.toThrow(NotFoundException);
    });
  });
});
