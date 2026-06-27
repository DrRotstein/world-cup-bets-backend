import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string };
}

@Controller('groups/:groupId/leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  async getLeaderboard(
    @Req() req: AuthenticatedRequest,
    @Param('groupId') groupId: string,
  ) {
    return this.leaderboardService.getLeaderboard(req.user.userId, groupId);
  }

  @Get(':userId')
  async getUserBreakdown(
    @Req() req: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.leaderboardService.getUserBreakdown(
      req.user.userId,
      groupId,
      targetUserId,
    );
  }
}
