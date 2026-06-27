import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { FootballDataClient } from '../src/matches/football-data.client';
import { JwtService } from '@nestjs/jwt';

describe('Leaderboard (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;

  const mockPrismaService: Record<string, unknown> = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Alice',
        avatarUrl: null,
        createdAt: new Date(),
      }),
    },
    group: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
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
      create: jest.fn(),
    },
    match: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
    bet: {
      upsert: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    score: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
      cb(mockPrismaService),
    ),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(FootballDataClient)
      .useValue({ getMatches: jest.fn().mockResolvedValue([]) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    authToken = jwtService.sign({ sub: 'user-1', email: 'test@example.com' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /groups/:groupId/leaderboard', () => {
    it('should return 401 without auth', () => {
      return request(app.getHttpServer()).get('/groups/group-1/leaderboard').expect(401);
    });

    it('should return leaderboard for group member', async () => {
      (mockPrismaService.score as { groupBy: jest.Mock }).groupBy
        .mockResolvedValueOnce([
          { userId: 'user-1', _sum: { points: 12 }, _count: { id: 3 } },
          { userId: 'user-2', _sum: { points: 8 }, _count: { id: 2 } },
        ])
        .mockResolvedValueOnce([
          { userId: 'user-1', type: 'EXACT', _count: { id: 2 } },
          { userId: 'user-1', type: 'DIFF', _count: { id: 1 } },
          { userId: 'user-2', type: 'OUTCOME', _count: { id: 2 } },
        ]);

      const response = await request(app.getHttpServer())
        .get('/groups/group-1/leaderboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('rank', 1);
      expect(response.body[0]).toHaveProperty('totalPoints', 12);
      expect(response.body[1]).toHaveProperty('rank', 2);
    });

    it('should return 404 for non-member', async () => {
      (
        mockPrismaService.membership as { findUnique: jest.Mock }
      ).findUnique.mockResolvedValueOnce(null);

      return request(app.getHttpServer())
        .get('/groups/group-1/leaderboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /groups/:groupId/leaderboard/:userId', () => {
    it('should return 401 without auth', () => {
      return request(app.getHttpServer())
        .get('/groups/group-1/leaderboard/user-1')
        .expect(401);
    });

    it('should return user point breakdown', async () => {
      (mockPrismaService.score as { findMany: jest.Mock }).findMany.mockResolvedValueOnce(
        [
          {
            matchId: 1001,
            points: 4,
            type: 'EXACT',
            userId: 'user-1',
            groupId: 'group-1',
          },
        ],
      );
      (mockPrismaService.bet as { findMany: jest.Mock }).findMany.mockResolvedValueOnce([
        { matchId: 1001, homeScorePrediction: 2, awayScorePrediction: 1 },
      ]);
      (mockPrismaService.match as { findMany: jest.Mock }).findMany.mockResolvedValueOnce(
        [
          {
            id: 1001,
            homeTeam: 'Brazil',
            awayTeam: 'Germany',
            homeScore: 2,
            awayScore: 1,
          },
        ],
      );

      const response = await request(app.getHttpServer())
        .get('/groups/group-1/leaderboard/user-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('points', 4);
      expect(response.body[0]).toHaveProperty('type', 'EXACT');
      expect(response.body[0]).toHaveProperty('homeTeam', 'Brazil');
    });
  });
});
