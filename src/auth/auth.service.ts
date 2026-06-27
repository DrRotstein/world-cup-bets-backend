import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { User } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
}

export interface GoogleTokenPayload {
  email: string;
  name: string;
  picture?: string;
}

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async validateGoogleToken(idToken: string): Promise<GoogleTokenPayload> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid Google token payload');
      }

      return {
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        picture: payload.picture,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  async loginWithGoogle(idToken: string): Promise<{ accessToken: string; user: User }> {
    const googlePayload = await this.validateGoogleToken(idToken);

    const user = await this.usersService.upsertFromGoogle({
      email: googlePayload.email,
      displayName: googlePayload.name,
      avatarUrl: googlePayload.picture,
    });

    const jwtPayload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(jwtPayload);

    return { accessToken, user };
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
