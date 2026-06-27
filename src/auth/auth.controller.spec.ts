import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    createdAt: new Date('2026-06-27T12:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            loginWithGoogle: jest.fn().mockResolvedValue({
              accessToken: 'mock-jwt-token',
              user: mockUser,
            }),
            getProfile: jest.fn().mockResolvedValue(mockUser),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService) as jest.Mocked<AuthService>;
  });

  describe('POST /auth/google', () => {
    it('should return access token and user on successful Google login', async () => {
      const result = await controller.googleLogin({
        idToken: 'valid-google-id-token',
      });

      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        user: {
          id: 'user-uuid-123',
          email: 'test@example.com',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
      });
      expect(authService.loginWithGoogle).toHaveBeenCalledWith('valid-google-id-token');
    });
  });

  describe('GET /auth/me', () => {
    it('should return the current user profile', async () => {
      const req = {
        user: { userId: 'user-uuid-123', email: 'test@example.com' },
      } as unknown as Parameters<typeof controller.getMe>[0];
      const result = await controller.getMe(req);

      expect(result).toEqual({
        id: 'user-uuid-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: mockUser.createdAt,
      });
      expect(authService.getProfile).toHaveBeenCalledWith('user-uuid-123');
    });
  });

  describe('POST /auth/logout', () => {
    it('should return success message', () => {
      const result = controller.logout();
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });
});
