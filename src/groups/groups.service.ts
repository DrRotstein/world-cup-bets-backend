import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateInviteCode } from './invite-code.util';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: { name: string; description?: string }) {
    const group = await this.prisma.group.create({
      data: {
        name: data.name,
        description: data.description,
        inviteCode: generateInviteCode(),
        createdBy: userId,
        memberships: {
          create: { userId },
        },
      },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    return group;
  }

  async findMyGroups(userId: string) {
    return this.prisma.group.findMany({
      where: {
        memberships: { some: { userId } },
      },
      include: {
        _count: { select: { memberships: true } },
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(groupId: string, requestingUserId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        memberships: {
          include: {
            user: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!group) {
      throw new NotFoundException(`Group not found`);
    }

    // Only members can see group details
    const isMember = group.memberships.some((m) => m.userId === requestingUserId);
    if (!isMember) {
      throw new NotFoundException(`Group not found`);
    }

    return group;
  }

  async joinByInviteCode(userId: string, inviteCode: string) {
    const group = await this.prisma.group.findUnique({
      where: { inviteCode },
    });

    if (!group) {
      throw new NotFoundException(`Invalid invite code`);
    }

    try {
      await this.prisma.membership.create({
        data: { userId, groupId: group.id },
      });
    } catch (error) {
      // P2002: unique constraint violation — user is already a member
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`Already a member of this group`);
      }
      throw error;
    }

    return this.prisma.group.findUnique({
      where: { id: group.id },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        _count: { select: { memberships: true } },
      },
    });
  }
}
