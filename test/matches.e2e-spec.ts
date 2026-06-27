import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { FootballDataClient } from '../src/matches/football-data.client';
import { MatchStatus } from '@prisma/client';

describe('Matches (e2e)', () => {
  let app: INestApplication;

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
      lastSyncedAt: new Date('2026-06-27T12:00:00Z'),
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
      lastSyncedAt: new Date('2026-06-27T12:00:00Z'),
    },
  ];

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
    },
    match: {
      findMany: jest.fn().mockResolvedValue(mockMatches),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: number } }) => {
        return Promise.resolve(mockMatches.find((m) => m.id === where.id) || null);
      }),
      upsert: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  const mockFootballDataClient = {
    getMatches: jest.fn().mockResolvedValue([]),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(FootballDataClient)
      .useValue(mockFootballDataClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /matches', () => {
    it('should return all matches', async () => {
      const response = await request(app.getHttpServer()).get('/matches').expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('homeTeam', 'Brazil');
      expect(response.body[1]).toHaveProperty('homeTeam', 'Argentina');
    });

    it('should accept status filter', async () => {
      await request(app.getHttpServer()).get('/matches?status=FINISHED').expect(200);

      expect(mockPrismaService.match.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'FINISHED' }),
        }),
      );
    });

    it('should accept stage filter', async () => {
      await request(app.getHttpServer()).get('/matches?stage=GROUP_STAGE').expect(200);
    });

    it('should reject invalid status', async () => {
      await request(app.getHttpServer()).get('/matches?status=INVALID').expect(400);
    });
  });

  describe('GET /matches/:id', () => {
    it('should return a match by id', async () => {
      const response = await request(app.getHttpServer())
        .get('/matches/1001')
        .expect(200);

      expect(response.body).toHaveProperty('homeTeam', 'Brazil');
      expect(response.body).toHaveProperty('awayTeam', 'Germany');
    });

    it('should return 404 for non-existent match', async () => {
      await request(app.getHttpServer()).get('/matches/9999').expect(404);
    });

    it('should reject non-numeric id', async () => {
      await request(app.getHttpServer()).get('/matches/abc').expect(400);
    });
  });
});
