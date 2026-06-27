import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { BetsService } from './bets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaceBetDto } from './dto/place-bet.dto';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string };
}

@Controller('groups/:groupId/bets')
@UseGuards(JwtAuthGuard)
export class BetsController {
  constructor(private readonly betsService: BetsService) {}

  @Post()
  async placeBet(
    @Req() req: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Body() dto: PlaceBetDto,
  ) {
    return this.betsService.placeBet(req.user.userId, groupId, {
      matchId: dto.matchId,
      homeScorePrediction: dto.homeScorePrediction,
      awayScorePrediction: dto.awayScorePrediction,
    });
  }

  @Get()
  async getMyBets(@Req() req: AuthenticatedRequest, @Param('groupId') groupId: string) {
    return this.betsService.getMyBets(req.user.userId, groupId);
  }

  @Get('matches/:matchId')
  async getMatchBets(
    @Req() req: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('matchId', ParseIntPipe) matchId: number,
  ) {
    return this.betsService.getMatchBets(req.user.userId, groupId, matchId);
  }
}
