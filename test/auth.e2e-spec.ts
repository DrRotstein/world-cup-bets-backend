import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    createdAt: new Date('2026-06-27T12:00:00Z'),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockResolvedValue(mockUser),
      upsert: jest.fn().mockResolvedValue(mockUser),
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/google', () => {
    it('should return 400 when idToken is missing', () => {
      return request(app.getHttpServer()).post('/auth/google').send({}).expect(400);
    });

    it('should return 400 when idToken is empty', () => {
      return request(app.getHttpServer())
        .post('/auth/google')
        .send({ idToken: '' })
        .expect(400);
    });

    it('should return 401 when Google token is invalid', async () => {
      // With the real AuthService, an invalid token will fail Google verification
      return request(app.getHttpServer())
        .post('/auth/google')
        .send({ idToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return 401 without auth header', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should return 401 with invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should return user profile with valid JWT', async () => {
      const token = jwtService.sign({ sub: 'user-uuid-123', email: 'test@example.com' });

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        id: 'user-uuid-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: mockUser.createdAt.toISOString(),
      });
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 401 without auth header', () => {
      return request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('should return success with valid JWT', async () => {
      const token = jwtService.sign({ sub: 'user-uuid-123', email: 'test@example.com' });

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ message: 'Logged out successfully' });
    });
  });
});
