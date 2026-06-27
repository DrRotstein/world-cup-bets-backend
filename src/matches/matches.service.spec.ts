import { Test, TestingModule } from '@nestjs/testing';
import { MatchesService } from './matches.service';
import { PrismaService } from '../prisma/prisma.service';
import { FootballDataClient } from './football-data.client';
import { MatchStatus } from '@prisma/client';

describe('MatchesService', () => {
  let service: MatchesService;
  let prisma: { match: Record<string, jest.Mock> };
  let footballDataClient: jest.Mocked<FootballDataClient>;

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
    {
      id: 1002,
      homeTeam: 'Argentina',
      awayTeam: 'France',
      kickoffTime: new Date('2026-07-10T21:00:00Z'),
      status: MatchStatus.FINISHED,
      homeScore: 2,
      awayScore: 1,
      matchday: 1,
      stage: 'GROUP_STAGE',
      group: 'Group B',
      lastSyncedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    prisma = {
      match: {
        findMany: jest.fn().mockResolvedValue(mockMatches),
        findUnique: jest.fn().mockResolvedValue(mockMatches[0]),
        upsert: jest.fn().mockResolvedValue(mockMatches[0]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: FootballDataClient,
          useValue: {
            getMatches: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
    footballDataClient = module.get(
      FootballDataClient,
    ) as jest.Mocked<FootballDataClient>;
  });

  describe('findAll', () => {
    it('should return all matches with no filters', async () => {
      const result = await service.findAll();
      expect(result).toEqual(mockMatches);
      expect(prisma.match.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { kickoffTime: 'asc' },
      });
    });

    it('should filter by status', async () => {
      await service.findAll({ status: MatchStatus.FINISHED });
      expect(prisma.match.findMany).toHaveBeenCalledWith({
        where: { status: MatchStatus.FINISHED },
        orderBy: { kickoffTime: 'asc' },
      });
    });

    it('should filter by stage', async () => {
      await service.findAll({ stage: 'GROUP_STAGE' });
      expect(prisma.match.findMany).toHaveBeenCalledWith({
        where: { stage: 'GROUP_STAGE' },
        orderBy: { kickoffTime: 'asc' },
      });
    });

    it('should filter by date range', async () => {
      const dateFrom = new Date('2026-07-10T00:00:00Z');
      const dateTo = new Date('2026-07-10T23:59:59Z');
      await service.findAll({ dateFrom, dateTo });
      expect(prisma.match.findMany).toHaveBeenCalledWith({
        where: { kickoffTime: { gte: dateFrom, lte: dateTo } },
        orderBy: { kickoffTime: 'asc' },
      });
    });
  });

  describe('findById', () => {
    it('should return a match by id', async () => {
      const result = await service.findById(1001);
      expect(result).toEqual(mockMatches[0]);
      expect(prisma.match.findUnique).toHaveBeenCalledWith({
        where: { id: 1001 },
      });
    });

    it('should return null when match not found', async () => {
      prisma.match.findUnique.mockResolvedValue(null);
      const result = await service.findById(9999);
      expect(result).toBeNull();
    });
  });

  describe('syncMatches', () => {
    it('should sync matches from football-data.org', async () => {
      const externalMatches = [
        {
          id: 2001,
          utcDate: '2026-07-10T18:00:00Z',
          status: 'SCHEDULED',
          matchday: 1,
          stage: 'GROUP_STAGE',
          group: 'Group A',
          homeTeam: { name: 'Mexico' },
          awayTeam: { name: 'Canada' },
          score: { fullTime: { home: null, away: null } },
        },
      ];
      footballDataClient.getMatches.mockResolvedValue(externalMatches);

      const result = await service.syncMatches();
      expect(result).toEqual({ synced: 1, errors: 0 });
      expect(prisma.match.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.match.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2001 },
          create: expect.objectContaining({
            id: 2001,
            homeTeam: 'Mexico',
            awayTeam: 'Canada',
            status: MatchStatus.SCHEDULED,
          }),
        }),
      );
    });

    it('should map IN_PLAY status to LIVE', async () => {
      const externalMatches = [
        {
          id: 3001,
          utcDate: '2026-07-10T18:00:00Z',
          status: 'IN_PLAY',
          matchday: 1,
          stage: 'GROUP_STAGE',
          group: 'Group A',
          homeTeam: { name: 'USA' },
          awayTeam: { name: 'England' },
          score: { fullTime: { home: 1, away: 0 } },
        },
      ];
      footballDataClient.getMatches.mockResolvedValue(externalMatches);

      await service.syncMatches();
      expect(prisma.match.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: MatchStatus.LIVE }),
        }),
      );
    });

    it('should handle API errors gracefully and return zero synced', async () => {
      footballDataClient.getMatches.mockRejectedValue(new Error('Network error'));

      const result = await service.syncMatches();
      expect(result).toEqual({ synced: 0, errors: 0 });
    });

    it('should count individual upsert errors', async () => {
      const externalMatches = [
        {
          id: 4001,
          utcDate: '2026-07-10T18:00:00Z',
          status: 'FINISHED',
          matchday: 1,
          stage: 'GROUP_STAGE',
          group: null,
          homeTeam: { name: 'Spain' },
          awayTeam: { name: 'Japan' },
          score: { fullTime: { home: 3, away: 1 } },
        },
      ];
      footballDataClient.getMatches.mockResolvedValue(externalMatches);
      prisma.match.upsert.mockRejectedValue(new Error('DB error'));

      const result = await service.syncMatches();
      expect(result).toEqual({ synced: 0, errors: 1 });
    });
  });
});
