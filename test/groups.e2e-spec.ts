import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Groups (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let authToken: string;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    createdAt: new Date('2026-06-27T12:00:00Z'),
  };

  const mockGroup = {
    id: 'group-1',
    name: 'World Cup Buddies',
    description: 'Our betting group',
    inviteCode: 'abc-123-def',
    createdBy: 'user-1',
    createdAt: new Date('2026-06-27T12:00:00Z'),
    creator: { id: 'user-1', displayName: 'Test User', avatarUrl: null },
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockResolvedValue(mockUser),
      upsert: jest.fn(),
    },
    group: {
      create: jest.fn().mockResolvedValue(mockGroup),
      findMany: jest
        .fn()
        .mockResolvedValue([{ ...mockGroup, _count: { memberships: 2 } }]),
      findUnique: jest.fn().mockResolvedValue({
        ...mockGroup,
        memberships: [
          {
            userId: 'user-1',
            joinedAt: new Date(),
            user: { id: 'user-1', displayName: 'Test User', avatarUrl: null },
          },
        ],
      }),
    },
    membership: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ userId: 'user-1', groupId: 'group-1' }),
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

  describe('POST /groups', () => {
    it('should return 401 without auth', () => {
      return request(app.getHttpServer())
        .post('/groups')
        .send({ name: 'Test Group' })
        .expect(401);
    });

    it('should return 400 without name', () => {
      return request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it('should create a group with valid data', async () => {
      const response = await request(app.getHttpServer())
        .post('/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'World Cup Buddies', description: 'Our betting group' })
        .expect(201);

      expect(response.body).toHaveProperty('id', 'group-1');
      expect(response.body).toHaveProperty('inviteCode', 'abc-123-def');
      expect(response.body).toHaveProperty('name', 'World Cup Buddies');
    });
  });

  describe('GET /groups', () => {
    it('should return 401 without auth', () => {
      return request(app.getHttpServer()).get('/groups').expect(401);
    });

    it('should return user groups', async () => {
      const response = await request(app.getHttpServer())
        .get('/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('memberCount', 2);
    });
  });

  describe('GET /groups/:id', () => {
    it('should return 401 without auth', () => {
      return request(app.getHttpServer()).get('/groups/group-1').expect(401);
    });

    it('should return group with members', async () => {
      const response = await request(app.getHttpServer())
        .get('/groups/group-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', 'group-1');
      expect(response.body).toHaveProperty('members');
      expect(response.body.members).toHaveLength(1);
    });
  });

  describe('POST /groups/join/:inviteCode', () => {
    it('should return 401 without auth', () => {
      return request(app.getHttpServer()).post('/groups/join/abc-123-def').expect(401);
    });

    it('should join a group with valid invite code', async () => {
      mockPrismaService.group.findUnique
        .mockResolvedValueOnce(mockGroup) // find by inviteCode
        .mockResolvedValueOnce({
          ...mockGroup,
          _count: { memberships: 3 },
        }); // after join

      const response = await request(app.getHttpServer())
        .post('/groups/join/abc-123-def')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('id', 'group-1');
    });

    it('should return 404 for invalid invite code', async () => {
      mockPrismaService.group.findUnique.mockResolvedValue(null);

      return request(app.getHttpServer())
        .post('/groups/join/invalid-code')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
