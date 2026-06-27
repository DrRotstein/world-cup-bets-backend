import { Controller, Post, Get, Param, Body, UseGuards, Req } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string };
}

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateGroupDto) {
    const group = await this.groupsService.create(req.user.userId, {
      name: dto.name,
      description: dto.description,
    });

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      inviteCode: group.inviteCode,
      createdBy: group.creator,
      createdAt: group.createdAt,
    };
  }

  @Get()
  async findMyGroups(@Req() req: AuthenticatedRequest) {
    const groups = await this.groupsService.findMyGroups(req.user.userId);
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      inviteCode: g.inviteCode,
      memberCount: g._count.memberships,
      createdBy: g.creator,
      createdAt: g.createdAt,
    }));
  }

  @Get(':id')
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const group = await this.groupsService.findById(id, req.user.userId);
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      inviteCode: group.inviteCode,
      createdBy: group.creator,
      createdAt: group.createdAt,
      members: group.memberships.map((m) => ({
        ...m.user,
        joinedAt: m.joinedAt,
      })),
    };
  }

  @Post('join/:inviteCode')
  async join(@Req() req: AuthenticatedRequest, @Param('inviteCode') inviteCode: string) {
    const group = await this.groupsService.joinByInviteCode(req.user.userId, inviteCode);
    return group;
  }
}
