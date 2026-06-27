import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { FootballDataClient } from '../src/matches/football-data.client';
import { JwtService } from '@nestjs/jwt';

describe('Bets (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;

  const futureDate = new Date(Date.now() + 86400000);
  const pastDate = new Date(Date.now() - 86400000);

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

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: null,
        createdAt: new Date(),
      }),
      upsert: jest.fn(),
    },
    group: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    membership: {
      findUnique: jest.fn().mockResolvedValue({ userId: 'user-1', groupId: 'group-1' }),
      create: jest.fn(),
    },
    match: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({
        id: 1001,
        homeTeam: 'Brazil',
        awayTeam: 'Germany',
        kickoffTime: futureDate,
        status: 'SCHEDULED',
        homeScore: null,
        awayScore: null,
      }),
      upsert: jest.fn(),
    },
    bet: {
      upsert: jest.fn().mockResolvedValue(mockBet),
      findMany: jest.fn().mockResolvedValue([mockBet]),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
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

  describe('POST /groups/:groupId/bets', () => {
    it('should return 401 without auth', () => {
      return request(app.getHttpServer())
        .post('/groups/group-1/bets')
        .send({ matchId: 1001, homeScorePrediction: 2, awayScorePrediction: 1 })
        .expect(401);
    });

    it('should return 400 with missing fields', () => {
      return request(app.getHttpServer())
        .post('/groups/group-1/bets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ matchId: 1001 })
        .expect(400);
    });

    it('should return 400 with negative score', () => {
      return request(app.getHttpServer())
        .post('/groups/group-1/bets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ matchId: 1001, homeScorePrediction: -1, awayScorePrediction: 0 })
        .expect(400);
    });

    it('should place a bet on a future match', async () => {
      const response = await request(app.getHttpServer())
        .post('/groups/group-1/bets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ matchId: 1001, homeScorePrediction: 2, awayScorePrediction: 1 })
        .expect(201);

      expect(response.body).toHaveProperty('id', 'bet-1');
      expect(response.body).toHaveProperty('homeScorePrediction', 2);
    });

    it('should return 400 for past match', async () => {
      mockPrismaService.match.findUnique.mockResolvedValueOnce({
        id: 1001,
        kickoffTime: pastDate,
        status: 'FINISHED',
      });

      return request(app.getHttpServer())
        .post('/groups/group-1/bets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ matchId: 1001, homeScorePrediction: 2, awayScorePrediction: 1 })
        .expect(400);
    });

    it('should return 403 if not a group member', async () => {
      mockPrismaService.membership.findUnique.mockResolvedValueOnce(null);

      return request(app.getHttpServer())
        .post('/groups/group-1/bets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ matchId: 1001, homeScorePrediction: 2, awayScorePrediction: 1 })
        .expect(403);
    });
  });

  describe('GET /groups/:groupId/bets', () => {
    it('should return 401 without auth', () => {
      return request(app.getHttpServer()).get('/groups/group-1/bets').expect(401);
    });

    it('should return user bets', async () => {
      const response = await request(app.getHttpServer())
        .get('/groups/group-1/bets')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('matchId', 1001);
    });
  });

  describe('GET /groups/:groupId/bets/matches/:matchId', () => {
    it('should return 401 without auth', () => {
      return request(app.getHttpServer())
        .get('/groups/group-1/bets/matches/1001')
        .expect(401);
    });

    it('should return bets for a match', async () => {
      const response = await request(app.getHttpServer())
        .get('/groups/group-1/bets/matches/1001')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
    });
  });
});
