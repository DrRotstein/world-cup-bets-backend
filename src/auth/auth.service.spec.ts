import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
    createdAt: new Date('2026-06-27T12:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            upsertFromGoogle: jest.fn().mockResolvedValue(mockUser),
            findById: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('mock-google-client-id'),
            get: jest.fn().mockReturnValue('7d'),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService) as jest.Mocked<UsersService>;
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
  });

  describe('loginWithGoogle', () => {
    it('should create user and return JWT on valid Google token', async () => {
      // Mock the Google token verification
      const mockPayload = {
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      };

      jest.spyOn(authService, 'validateGoogleToken').mockResolvedValue(mockPayload);

      const result = await authService.loginWithGoogle('valid-id-token');

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user).toEqual(mockUser);
      expect(usersService.upsertFromGoogle).toHaveBeenCalledWith({
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-uuid-123',
        email: 'test@example.com',
      });
    });

    it('should throw UnauthorizedException on invalid Google token', async () => {
      jest
        .spyOn(authService, 'validateGoogleToken')
        .mockRejectedValue(new UnauthorizedException('Invalid Google token'));

      await expect(authService.loginWithGoogle('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile for valid user id', async () => {
      const result = await authService.getProfile('user-uuid-123');
      expect(result).toEqual(mockUser);
      expect(usersService.findById).toHaveBeenCalledWith('user-uuid-123');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(authService.getProfile('nonexistent-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
